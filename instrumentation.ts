import {
  BasicTracerProvider,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function register() {
  const isDev =
    process.env.ENVIRONMENT === "development" ||
    process.env.NODE_ENV === "development";

  const provider = new BasicTracerProvider({
    resource: new Resource({ [ATTR_SERVICE_NAME]: "my-url-shortener" }),
  });

  if (isDev) {
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  } else {
    if (!process.env.GRAFANA_AUTH_TOKEN) {
      console.warn(
        "GRAFANA_AUTH_TOKEN is not set. OpenTelemetry traces will not be sent to Grafana."
      );
    }

    const exporter = new OTLPTraceExporter({
      url:
        process.env.GRAFANA_OTLP_ENDPOINT ||
        "https://otlp-gateway-prod-ap-northeast-0.grafana.net/otlp/v1/traces",
      headers: {
        Authorization: `Basic ${process.env.GRAFANA_AUTH_TOKEN}`,
      },
    });

    provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  provider.register();
}
