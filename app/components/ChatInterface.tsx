"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "ai";

interface ChatInterfaceProps {
  onShorten: (shortCode: string, longUrl: string) => void;
}

/**
 * アシスタント応答の表示フォールバック。
 * システムプロンプトでマークダウン禁止を指示しているが、モデルが従わないことがあるため、
 * `...` で囲まれた部分はコード風スパンに整形して生のバッククォートを見せない。
 */
function AssistantText({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code
            key={index}
            className="font-mono text-[0.9em] bg-muted/60 rounded px-1 break-all"
          >
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** UrlShortener と同じローディングスピナー。 */
function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

/** UIMessage のテキストパートを連結する。 */
function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/** ツールパート（type が "tool-" または "dynamic-tool"）を取り出す。 */
interface ToolPartView {
  key: string;
  toolName: string;
  output: unknown;
}
function toolParts(message: UIMessage): ToolPartView[] {
  const views: ToolPartView[] = [];
  for (const part of message.parts) {
    const p = part as { type: string; toolCallId?: string; toolName?: string; output?: unknown };
    if (p.type.startsWith("tool-")) {
      views.push({
        key: p.toolCallId ?? `${message.id}-${views.length}`,
        toolName: p.type.slice("tool-".length),
        output: p.output,
      });
    } else if (p.type === "dynamic-tool" && p.toolName) {
      views.push({
        key: p.toolCallId ?? `${message.id}-${views.length}`,
        toolName: p.toolName,
        output: p.output,
      });
    }
  }
  return views;
}

export default function ChatInterface({ onShorten }: ChatInterfaceProps) {
  // ページロードごとにランダムな session id を生成（メモリ保持のみ・storage 非保存）。
  // リロードすると新しい DO に接続するため、会話履歴は実質リセットされる。
  const [sessionId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // onShorten を多重発火させないため、処理済みツール結果を記録する。
  const processedToolKeys = useRef<Set<string>>(new Set());

  const agent = useAgent({ agent: "url-chat-agent", name: sessionId });
  const { messages, sendMessage, status, error } = useAgentChat({ agent });

  const sending = status === "submitted" || status === "streaming";

  // shorten_url の結果が来たら履歴（HistoryList）へ反映する。
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const view of toolParts(message)) {
        if (view.toolName !== "shorten_url") continue;
        if (processedToolKeys.current.has(view.key)) continue;
        const output = view.output as { code?: string; long_url?: string } | undefined;
        if (output?.code && output.long_url) {
          processedToolKeys.current.add(view.key);
          onShorten(output.code, output.long_url);
        }
      }
    }
  }, [messages, onShorten]);

  // メッセージ更新時に最下部へ自動スクロール（jsdom には scrollIntoView がない）。
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const isEmpty = useMemo(() => messages.length === 0, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    void sendMessage({ text });
  };

  return (
    <div className="bg-background rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 w-full max-w-md border border-border">
      <h2 className="text-2xl font-bold text-foreground mb-6 text-center tracking-tight">
        チャットで短縮
      </h2>

      <div className="space-y-4">
        <div className="space-y-3 max-h-80 overflow-y-auto" aria-live="polite">
          {isEmpty && (
            <p className="text-sm text-muted-foreground text-center py-4">
              例:「https://example.com を短縮して」と話しかけてください。
            </p>
          )}

          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <div
                  key={message.id}
                  className="ml-auto max-w-[85%] bg-primary/10 rounded-lg px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words"
                >
                  {messageText(message)}
                </div>
              );
            }
            const text = messageText(message);
            const tools = toolParts(message);
            return (
              <div key={message.id} className="space-y-2">
                {tools.map((view) => (
                  <div
                    key={view.key}
                    className="mr-auto max-w-[85%] text-xs text-muted-foreground border border-border rounded-lg px-3 py-2"
                  >
                    <p className="font-semibold mb-1">ツール実行: {view.toolName}</p>
                    <pre className="whitespace-pre-wrap break-all font-mono">
                      {JSON.stringify(view.output, null, 2)}
                    </pre>
                  </div>
                ))}
                {text && (
                  <div className="mr-auto max-w-[85%] bg-accent/5 border border-border rounded-lg px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words">
                    <AssistantText text={text} />
                  </div>
                )}
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="mr-auto max-w-[85%] bg-accent/5 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
              ...
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm break-all">
              エラーが発生しました: {error.message}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            メッセージを入力
          </label>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="短縮したいURLを伝えてください"
            disabled={sending}
            className="flex-1 px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-input text-foreground transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-primary text-primary-foreground font-semibold px-4 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all transform active:scale-[0.98]"
          >
            {sending ? <Spinner /> : "送信"}
          </button>
        </form>
      </div>
    </div>
  );
}
