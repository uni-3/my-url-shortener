import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UIMessage } from "ai";
import ChatInterface from "@/app/components/ChatInterface";

// agents SDK のフックは WebSocket(DurableObject) に接続するためモックする。
const { mockUseAgent, mockUseAgentChat, mockSendMessage } = vi.hoisted(() => ({
  mockUseAgent: vi.fn(),
  mockUseAgentChat: vi.fn(),
  mockSendMessage: vi.fn(),
}));

vi.mock("agents/react", () => ({ useAgent: mockUseAgent }));
vi.mock("agents/ai-react", () => ({ useAgentChat: mockUseAgentChat }));

function setChat(overrides: Partial<ReturnType<typeof mockUseAgentChat>> = {}) {
  mockUseAgentChat.mockReturnValue({
    messages: [] as UIMessage[],
    sendMessage: mockSendMessage,
    status: "ready",
    error: undefined,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAgent.mockReturnValue({ agent: "url-chat-agent", name: "test-session" });
  setChat();
});

describe("ChatInterface (agents SDK)", () => {
  it("空の状態でプレースホルダを表示する", () => {
    render(<ChatInterface onShorten={vi.fn()} />);
    expect(screen.getByText("チャットで短縮")).toBeDefined();
    expect(
      screen.getByText("例:「https://example.com を短縮して」と話しかけてください。"),
    ).toBeDefined();
  });

  it("送信すると sendMessage が呼ばれる", () => {
    render(<ChatInterface onShorten={vi.fn()} />);
    const input = screen.getByLabelText("メッセージを入力");
    fireEvent.change(input, { target: { value: "https://example.com を短縮して" } });
    fireEvent.submit(input.closest("form")!);
    expect(mockSendMessage).toHaveBeenCalledWith({ text: "https://example.com を短縮して" });
  });

  it("メッセージ（user/assistant）を描画する", () => {
    setChat({
      messages: [
        { id: "1", role: "user", parts: [{ type: "text", text: "やっほー" }] },
        { id: "2", role: "assistant", parts: [{ type: "text", text: "短縮しました" }] },
      ] as UIMessage[],
    });
    render(<ChatInterface onShorten={vi.fn()} />);
    expect(screen.getByText("やっほー")).toBeDefined();
    expect(screen.getByText("短縮しました")).toBeDefined();
  });

  it("shorten_url ツール結果で onShorten を呼ぶ", () => {
    const onShorten = vi.fn();
    setChat({
      messages: [
        {
          id: "3",
          role: "assistant",
          parts: [
            {
              type: "tool-shorten_url",
              toolCallId: "call-1",
              state: "output-available",
              output: { code: "abc123", long_url: "https://example.com" },
            },
          ],
        },
      ] as unknown as UIMessage[],
    });
    render(<ChatInterface onShorten={onShorten} />);
    expect(onShorten).toHaveBeenCalledWith("abc123", "https://example.com");
  });
});
