import {
  OTLPExporterBase,
  type OTLPExporterConfigBase,
} from "@opentelemetry/otlp-exporter-base";
import { createLegacyOtlpBrowserExportDelegate } from "@opentelemetry/otlp-exporter-base/browser-http";
import { JsonTraceSerializer } from "@opentelemetry/otlp-transformer";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

export class WorkersOTLPTraceExporter
  extends OTLPExporterBase<ReadableSpan[]>
  implements SpanExporter
{
  constructor(config: OTLPExporterConfigBase = {}) {
    super(
      createLegacyOtlpBrowserExportDelegate(
        config,
        JsonTraceSerializer,
        "v1/traces",
        { "Content-Type": "application/json" }
      )
    );
  }
}

