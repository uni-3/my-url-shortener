import { scheduleOtelFlush as scheduleOtelFlushFromProvider } from "@/lib/otel/init";

type WaitUntilContext = { waitUntil: (p: Promise<unknown>) => void };

export function scheduleOtelFlush(ctx: WaitUntilContext): void {
  scheduleOtelFlushFromProvider(ctx);
}
