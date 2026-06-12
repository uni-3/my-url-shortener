/**
 * Chrome Prompt API (Gemini Nano / LanguageModel) の最小限の手書き型定義。
 * https://developer.chrome.com/docs/ai/prompt-api
 *
 * 実験的APIで公式の @types が安定していないため、本プロジェクトで使う範囲のみ宣言する
 * （新しい依存を増やさない・tsconfig の types 配列も変更しない方針）。
 * 未対応ブラウザではグローバルが存在しないため、`typeof LanguageModel === "undefined"`
 * で判定できるよう `| undefined` を含めて宣言している。
 */

type LanguageModelAvailability = "unavailable" | "downloadable" | "downloading" | "available";

/** Prompt API に渡すツール定義（MCPツールをブリッジする）。 */
interface LanguageModelTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<string>;
}

interface LanguageModelInitialPrompt {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LanguageModelSession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream<string>;
  inputUsage: number;
  inputQuota: number;
  destroy(): void;
}

interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelInitialPrompt[];
  tools?: LanguageModelTool[];
  monitor?(m: EventTarget): void;
  signal?: AbortSignal;
}

/** create() の monitor に届く "downloadprogress" イベント。loaded は 0〜1 の進捗率。 */
interface LanguageModelDownloadProgressEvent extends Event {
  loaded: number;
}

declare const LanguageModel:
  | {
      availability(): Promise<LanguageModelAvailability>;
      create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
    }
  | undefined;
