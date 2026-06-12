import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ChatInterface from "@/app/components/ChatInterface";

// MCPブリッジはネットワークに出るためモックする（SDK自体もロードさせない）
const { mockCreateMcpClient, mockBuildPromptApiTools } = vi.hoisted(() => ({
  mockCreateMcpClient: vi.fn(),
  mockBuildPromptApiTools: vi.fn(),
}));

vi.mock("@/lib/chat/mcp-bridge", () => ({
  createMcpClient: mockCreateMcpClient,
  buildPromptApiTools: mockBuildPromptApiTools,
}));

type GlobalWithLanguageModel = typeof globalThis & { LanguageModel?: unknown };

function streamOf(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateMcpClient.mockResolvedValue({});
  mockBuildPromptApiTools.mockResolvedValue([]);
});

afterEach(() => {
  delete (globalThis as GlobalWithLanguageModel).LanguageModel;
});

describe("ChatInterface without the Prompt API", () => {
  it("shows an error message", async () => {
    render(<ChatInterface onShorten={vi.fn()} />);

    expect(
      screen.getByText("このブラウザではオンデバイスAI (Prompt API) を利用できません。"),
    ).toBeDefined();
  });
});

describe("ChatInterface with a mocked Prompt API", () => {
  const destroy = vi.fn();
  let promptStreaming: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    promptStreaming = vi.fn().mockReturnValue(streamOf(["短縮", "しました"]));
    create = vi.fn().mockResolvedValue({
      promptStreaming,
      prompt: vi.fn(),
      inputUsage: 0,
      inputQuota: 1024,
      destroy,
    });
    (globalThis as GlobalWithLanguageModel).LanguageModel = {
      availability: vi.fn().mockResolvedValue("available"),
      create,
    };
  });

  it("streams the assistant reply after sending a message", async () => {
    render(<ChatInterface onShorten={vi.fn()} />);

    // availability() 解決後にチャットUIが表示される
    const input = await screen.findByLabelText("メッセージを入力");
    fireEvent.change(input, { target: { value: "https://example.com を短縮して" } });
    fireEvent.submit(input.closest("form")!);

    // ユーザーのメッセージが表示される
    expect(await screen.findByText("https://example.com を短縮して")).toBeDefined();

    // ストリーミングされたアシスタントの応答が結合されて表示される
    expect(await screen.findByText("短縮しました")).toBeDefined();

    // セッションはシステムプロンプトとMCP由来のツールで生成される
    expect(create).toHaveBeenCalledTimes(1);
    const options = create.mock.calls[0][0];
    expect(options.initialPrompts[0].role).toBe("system");
    expect(options.initialPrompts[0].content).toContain("shorten_url");
    expect(mockCreateMcpClient).toHaveBeenCalledTimes(1);
    expect(mockBuildPromptApiTools).toHaveBeenCalledTimes(1);
    expect(promptStreaming).toHaveBeenCalledWith("https://example.com を短縮して");
  });

  it("destroys the session on unmount", async () => {
    const { unmount } = render(<ChatInterface onShorten={vi.fn()} />);

    const input = await screen.findByLabelText("メッセージを入力");
    fireEvent.change(input, { target: { value: "テスト" } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByText("短縮しました");

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
