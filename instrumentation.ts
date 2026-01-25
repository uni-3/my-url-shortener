import { registerOTel } from "@vercel/otel";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

export function register() {
  if (process.env.NODE_ENV === "development") {
    registerOTel({
      serviceName: "my-url-shortener",
      spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });
  } else {
    // 本番環境ではCloudflare Workers Observability（Logpush/Destinations）を使用。
    // registerOTelを呼び出すことでNext.jsの自動計測（fetch等）を有効にし、
    // 生成されたスパンはCloudflareのランタイムによって自動的にキャプチャされます。
    registerOTel({ serviceName: "my-url-shortener" });
  }
}
