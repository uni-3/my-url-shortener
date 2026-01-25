import { registerOTel } from "@vercel/otel";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

export function register() {
  registerOTel({
    serviceName: "my-url-shortener",
    spanProcessors: process.env.NODE_ENV === "development"
      ? [new SimpleSpanProcessor(new ConsoleSpanExporter())]
      : []
  });
}
