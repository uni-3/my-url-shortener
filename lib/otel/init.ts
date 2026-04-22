import { diag, DiagConsoleLogger, DiagLogLevel, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { WorkersOTLPTraceExporter } from "./workers-otlp-trace-exporter";

type OTelEnv = {
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  GRAFANA_AUTH_TOKEN?: string;
  GRAFANA_OTLP_ENDPOINT?: string;
  OTEL_CONSOLE_EXPORTER?: string;
};

type WaitUntilContext = { waitUntil: (p: Promise<unknown>) => void };

let initialized = false;
let activeProvider: BasicTracerProvider | undefined;

function readEnvVar(env: OTelEnv, key: keyof OTelEnv): string | undefined {
  const fromEnv = env[key];
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  try {
    const fromProcessEnv = (process.env as Record<string, string | undefined>)[
      key as string
    ];
    return typeof fromProcessEnv === "string" && fromProcessEnv.length > 0
      ? fromProcessEnv
      : undefined;
  } catch {
    return undefined;
  }
}

function isProbablyRawGrafanaApiKey(token: string): boolean {
  return token.startsWith("glc_") || token.includes(":");
}

function toDiagLogLevel(logLevel: string | undefined): DiagLogLevel {
  if (logLevel === "debug") return DiagLogLevel.DEBUG;
  if (logLevel === "info") return DiagLogLevel.INFO;
  return DiagLogLevel.WARN;
}

export function ensureOtelInitialized(env: OTelEnv = {}): void {
  if (initialized) return;
  initialized = true;

  const environment = readEnvVar(env, "ENVIRONMENT") ?? "unknown";
  const logLevel = readEnvVar(env, "LOG_LEVEL") ?? "info";

  // Make exporter/network errors visible in Workers Logs.
  diag.setLogger(new DiagConsoleLogger(), toDiagLogLevel(logLevel));

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "my-url-shortener",
  });

  const spanProcessors: SpanProcessor[] = [];

  const authToken = readEnvVar(env, "GRAFANA_AUTH_TOKEN");
  const endpoint =
    readEnvVar(env, "GRAFANA_OTLP_ENDPOINT") ||
    "https://otlp-gateway-prod-ap-northeast-0.grafana.net/otlp/v1/traces";

  // One-time init log so we can tell if init ran (and with what config).
  console.log("[otel] init", {
    environment,
    logLevel,
    endpoint,
    hasGrafanaAuthToken: Boolean(authToken),
  });

  if (authToken && isProbablyRawGrafanaApiKey(authToken)) {
    console.warn(
      "[otel] GRAFANA_AUTH_TOKEN looks like a raw API key (e.g. 'glc_...'). Expected Base64(UserID:APIKey) for Basic auth."
    );
  }

  if (authToken) {
    const exporter = new WorkersOTLPTraceExporter({
      url: endpoint,
      headers: {
        Authorization: `Basic ${authToken}`,
      },
    });
    spanProcessors.push(new BatchSpanProcessor(exporter));
  } else {
    console.warn(
      "[otel] GRAFANA_AUTH_TOKEN is not set. OpenTelemetry traces will not be sent to Grafana."
    );
  }

  const consoleExporterEnabled =
    logLevel === "debug" || readEnvVar(env, "OTEL_CONSOLE_EXPORTER") === "1";
  if (consoleExporterEnabled) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors,
  });

  activeProvider = provider;
  trace.setGlobalTracerProvider(provider);
}

export function scheduleOtelFlush(ctx: WaitUntilContext): void {
  if (!activeProvider) return;
  ctx.waitUntil(
    activeProvider.forceFlush().catch((error) => {
      console.error("[otel] forceFlush failed:", error);
    })
  );
}

