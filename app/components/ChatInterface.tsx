"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createMcpClient,
  buildPromptApiTools,
  type ToolResultEvent,
} from "@/lib/chat/mcp-bridge";

interface ChatInterfaceProps {
  onShorten: (shortCode: string, longUrl: string) => void;
}

/** Prompt API の利用可否〜セッション準備までの状態遷移。 */
type ChatStatus = "checking" | "unsupported" | "downloadable" | "downloading" | "ready" | "error";

interface ChatMessage {
  role: "user" | "assistant" | "tool";
  text: string;
  toolName?: string;
}

type MessagesAction = { type: "append"; message: ChatMessage };

function messagesReducer(state: ChatMessage[], action: MessagesAction): ChatMessage[] {
  switch (action.type) {
    case "append":
      return [...state, action.message];
  }
}

const SYSTEM_PROMPT =
  "あなたはURL短縮アシスタントです。" +
  "URLの短縮を頼まれたら、必ず shorten_url ツールを使って短縮してください。" +
  "短縮コードから元のURLを調べるよう頼まれたら、必ず resolve_url ツールを使ってください。" +
  "簡潔に日本語で答えてください。";

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

export default function ChatInterface({ onShorten }: ChatInterfaceProps) {
  const [status, setStatus] = useState<ChatStatus>("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorDetail, setErrorDetail] = useState("");
  const [messages, dispatch] = useReducer(messagesReducer, []);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const sessionRef = useRef<LanguageModelSession | null>(null);
  const toolsRef = useRef<LanguageModelTool[] | null>(null);

  // マウント時にPrompt APIの利用可否を判定する
  useEffect(() => {
    if (typeof LanguageModel === "undefined") {
      setStatus("unsupported");
      return;
    }
    let cancelled = false;
    LanguageModel.availability()
      .then((availability) => {
        if (cancelled) return;
        if (availability === "unavailable") {
          setStatus("unsupported");
        } else if (availability === "available") {
          setStatus("ready");
        } else {
          // downloadable / downloading: create() はユーザー操作が必要なのでボタンを出す
          setStatus("downloadable");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // アンマウント時にセッションを破棄する
  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  const handleToolResult = useCallback(
    (event: ToolResultEvent) => {
      dispatch({
        type: "append",
        message: { role: "tool", text: event.resultText, toolName: event.toolName },
      });
      // 短縮に成功したら履歴（HistoryList）にも反映する
      if (event.toolName === "shorten_url" && !event.isError) {
        try {
          const payload = JSON.parse(event.resultText) as { code?: string; long_url?: string };
          if (payload.code && payload.long_url) {
            onShorten(payload.code, payload.long_url);
          }
        } catch {
          // ツール結果がJSONでなければ履歴登録はスキップ
        }
      }
    },
    [onShorten],
  );

  /** セッションを遅延生成する。MCPクライアント/ツールも初回のみ生成。 */
  const ensureSession = useCallback(async (): Promise<LanguageModelSession> => {
    if (sessionRef.current) return sessionRef.current;
    if (typeof LanguageModel === "undefined") {
      throw new Error("Prompt API が利用できません");
    }
    if (!toolsRef.current) {
      const client = await createMcpClient();
      toolsRef.current = await buildPromptApiTools(client, handleToolResult);
    }
    const session = await LanguageModel.create({
      initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
      tools: toolsRef.current,
      monitor(m) {
        m.addEventListener("downloadprogress", (event) => {
          const loaded = (event as LanguageModelDownloadProgressEvent).loaded;
          setDownloadProgress(Math.round(loaded * 100));
        });
      },
    });
    sessionRef.current = session;
    return session;
  }, [handleToolResult]);

  const failWithError = (error: unknown) => {
    setErrorDetail(error instanceof Error ? error.message : String(error));
    setStatus("error");
  };

  // モデルのダウンロード（create() はユーザー操作起点で呼ぶ必要がある）
  const handleDownload = async () => {
    setDownloadProgress(0);
    setStatus("downloading");
    try {
      await ensureSession();
      setStatus("ready");
    } catch (error) {
      failWithError(error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    dispatch({ type: "append", message: { role: "user", text } });

    let session: LanguageModelSession;
    try {
      session = await ensureSession();
    } catch (error) {
      // セッション生成に失敗（tools未対応バージョン等）した場合はエラーパネルへ
      failWithError(error);
      setSending(false);
      return;
    }

    try {
      setStreamingText("");
      let accumulated = "";
      const reader = session.promptStreaming(text).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += value;
        setStreamingText(accumulated);
      }
      dispatch({ type: "append", message: { role: "assistant", text: accumulated } });
    } catch (error) {
      dispatch({
        type: "append",
        message: {
          role: "assistant",
          text: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    } finally {
      setStreamingText(null);
      setSending(false);
    }
  };

  return (
    <div className="bg-background rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 w-full max-w-md border border-border">
      <h2 className="text-2xl font-bold text-foreground mb-6 text-center tracking-tight">
        チャットで短縮
      </h2>

      {status === "checking" && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
          <Spinner />
          利用可能か確認中です...
        </div>
      )}

      {status === "unsupported" && (
        <div className="p-4 bg-accent/5 border border-border rounded-lg text-sm text-foreground/80 space-y-3">
          <p className="font-semibold text-foreground">
            このブラウザではオンデバイスAI (Prompt API) を利用できません。
          </p>
          <p>最新のデスクトップ版Chromeで、以下の手順で有効化できます：</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
            <li>
              <code className="font-mono">chrome://flags/#prompt-api-for-gemini-nano</code> を
              「Enabled」に設定します
            </li>
            <li>
              <code className="font-mono">chrome://flags/#optimization-guide-on-device-model</code>{" "}
              を「Enabled BypassPerfRequirement」に設定します
            </li>
            <li>Chromeを再起動します</li>
            <li>
              <code className="font-mono">chrome://components</code> で「Optimization Guide On
              Device Model」を更新します
            </li>
          </ol>
        </div>
      )}

      {status === "downloadable" && (
        <div className="space-y-4">
          <p className="text-sm text-foreground/80">
            チャットを利用するには、オンデバイスAIモデル (Gemini Nano)
            のダウンロードが必要です。ダウンロードはこの端末内で一度だけ行われます。
          </p>
          <button
            onClick={handleDownload}
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:opacity-90 transition-all transform active:scale-[0.98]"
          >
            モデルをダウンロード
          </button>
        </div>
      )}

      {status === "downloading" && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
          <Spinner />
          モデルをダウンロード中です... {downloadProgress}%
        </div>
      )}

      {status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm space-y-2">
          <p className="font-semibold">チャットを初期化できませんでした。</p>
          {errorDetail && <p className="text-xs break-all">{errorDetail}</p>}
          <p className="text-xs">
            お使いのChromeのバージョンがPrompt APIのtools機能に未対応の可能性があります。最新版に更新してから再度お試しください。
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="space-y-4">
          <div className="space-y-3 max-h-80 overflow-y-auto" aria-live="polite">
            {messages.length === 0 && streamingText === null && (
              <p className="text-sm text-muted-foreground text-center py-4">
                例:「https://example.com を短縮して」と話しかけてください。
              </p>
            )}
            {messages.map((message, index) =>
              message.role === "tool" ? (
                <div
                  key={index}
                  className="mr-auto max-w-[85%] text-xs text-muted-foreground border border-border rounded-lg px-3 py-2"
                >
                  <p className="font-semibold mb-1">ツール実行: {message.toolName}</p>
                  <pre className="whitespace-pre-wrap break-all font-mono">{message.text}</pre>
                </div>
              ) : (
                <div
                  key={index}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] bg-primary/10 rounded-lg px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words"
                      : "mr-auto max-w-[85%] bg-accent/5 border border-border rounded-lg px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words"
                  }
                >
                  {message.text}
                </div>
              ),
            )}
            {streamingText !== null && (
              <div className="mr-auto max-w-[85%] bg-accent/5 border border-border rounded-lg px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words">
                {streamingText === "" ? "..." : streamingText}
              </div>
            )}
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
      )}
    </div>
  );
}
