import { registerOTel } from "@vercel/otel";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

export function register() {
  if (process.env.NODE_ENV === "development") {
    registerOTel({
      serviceName: "my-url-shortener",
      spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });
  } else {
    // 本番環境ではデフォルトのエクスポーター（VercelやOTLP環境変数）を使用
    registerOTel({ serviceName: "my-url-shortener" });
  }
}
