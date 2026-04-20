import { trace } from "@opentelemetry/api";

type WaitUntilContext = { waitUntil: (p: Promise<unknown>) => void };

export function scheduleOtelFlush(ctx: WaitUntilContext): void {
  const provider = trace.getTracerProvider() as { forceFlush?: () => Promise<void> };
  if (typeof provider.forceFlush === "function") {
    ctx.waitUntil(provider.forceFlush());
  }
}
