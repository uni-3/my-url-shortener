import {
  BasicTracerProvider,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { trace } from "@opentelemetry/api";

export function register() {
  const isDev =
    process.env.ENVIRONMENT === "development" ||
    process.env.NODE_ENV === "development";

  const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: "my-url-shortener" });

  if (isDev) {
    const provider = new BasicTracerProvider({
      resource,
      spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });
    trace.setGlobalTracerProvider(provider);
  } else {
    const spanProcessors: SpanProcessor[] = [new SimpleSpanProcessor(new ConsoleSpanExporter())];

    if (process.env.GRAFANA_AUTH_TOKEN) {
      const exporter = new OTLPTraceExporter({
        url:
          process.env.GRAFANA_OTLP_ENDPOINT ||
          "https://otlp-gateway-prod-ap-northeast-0.grafana.net/otlp/v1/traces",
        headers: {
          Authorization: `Basic ${process.env.GRAFANA_AUTH_TOKEN}`,
        },
      });
      spanProcessors.unshift(new BatchSpanProcessor(exporter));
    } else {
      console.warn(
        "GRAFANA_AUTH_TOKEN is not set. OpenTelemetry traces will not be sent to Grafana."
      );
    }

    const provider = new BasicTracerProvider({ resource, spanProcessors });
    trace.setGlobalTracerProvider(provider);
  }
}
