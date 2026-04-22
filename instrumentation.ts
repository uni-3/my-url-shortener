import { registerOTel } from "@vercel/otel";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export function register() {
  const isDev =
    process.env.ENVIRONMENT === "development" ||
    process.env.NODE_ENV === "development";
  console.log(
    `isDev: ${isDev}, Environment: ${process.env.ENVIRONMENT}, NODE_ENV: ${process.env.NODE_ENV}`
  );

  if (isDev) {
    console.log(
      "Initializing OpenTelemetry with ConsoleSpanExporter (Development Mode)"
    );
    registerOTel({
      serviceName: "my-url-shortener",
      spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });
  } else {
    if (!process.env.GRAFANA_AUTH_TOKEN) {
      console.warn(
        "GRAFANA_AUTH_TOKEN is not set. OpenTelemetry traces will not be sent to Grafana."
      );
    }

    console.log(
      "Initializing OpenTelemetry with OTLPTraceExporter for Grafana (Production Mode)"
    );
    const exporter = new OTLPTraceExporter({
      url:
        process.env.GRAFANA_OTLP_ENDPOINT ||
        "https://otlp-gateway-prod-ap-northeast-0.grafana.net/otlp",
      headers: {
        Authorization: `Basic ${process.env.GRAFANA_AUTH_TOKEN}`,
      },
    });

    registerOTel({
      serviceName: "my-url-shortener",
      spanProcessors: [
        new BatchSpanProcessor(exporter),
        new SimpleSpanProcessor(new ConsoleSpanExporter()),
      ],
    });
  }
}
