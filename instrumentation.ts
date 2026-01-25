import { registerOTel } from "@vercel/otel";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export function register() {
  const spanProcessors = [];

  // 開発環境ではコンソールに出力
  if (process.env.NODE_ENV === "development") {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  // Axiomの設定がある場合はAxiomに送信
  if (process.env.API_TOKEN && process.env.DATASET_NAME) {
    const axiomExporter = new OTLPTraceExporter({
      url: `https://${process.env.AXIOM_DOMAIN || "api.axiom.co"}/v1/traces`,
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "X-Axiom-Dataset": process.env.DATASET_NAME,
      },
    });
    spanProcessors.push(new SimpleSpanProcessor(axiomExporter));
  }

  registerOTel({
    serviceName: "my-url-shortener",
    spanProcessors: spanProcessors.length > 0 ? spanProcessors : undefined,
  });
}
