import { ensureOtelInitialized } from "./lib/otel/init";

export function register() {
  if (process.env.LOG_LEVEL === "debug") {
    console.log("[otel] instrumentation.register called");
  }
  ensureOtelInitialized(process.env as unknown as {
    ENVIRONMENT?: string;
    LOG_LEVEL?: string;
    GRAFANA_AUTH_TOKEN?: string;
    GRAFANA_OTLP_ENDPOINT?: string;
    OTEL_CONSOLE_EXPORTER?: string;
  });
}
