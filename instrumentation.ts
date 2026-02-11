import { registerOTel } from "@vercel/otel";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export function register() {
  const isDev = process.env.ENVIRONMENT === "development" || process.env.NODE_ENV === "development";

  if (isDev) {
    console.log("Initializing OpenTelemetry with ConsoleSpanExporter (Development Mode)");
    registerOTel({
      serviceName: "my-url-shortener",
      spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });
  } else {
    console.log("Initializing OpenTelemetry with OTLPTraceExporter for Grafana (Production Mode)");
    const exporter = new OTLPTraceExporter({
      url: process.env.GRAFANA_OTLP_ENDPOINT || "https://otlp-gateway-prod-ap-northeast-0.grafana.net/otlp/v1/traces",
      headers: {
        Authorization: `Basic ${process.env.GRAFANA_AUTH_TOKEN}`,
      },
    });

    registerOTel({
      serviceName: "my-url-shortener",
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
  }
}
