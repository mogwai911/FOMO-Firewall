import type { IngestionFailureCode } from "@/lib/collect/types";

export function classifyIngestionFailure(error: unknown): IngestionFailureCode {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("timeout") || message.includes("timed out")) {
    return "TIMEOUT";
  }

  if (
    message.includes("403") ||
    message.includes("forbidden") ||
    message.includes("blocked") ||
    message.includes("cloudflare") ||
    message.includes("captcha")
  ) {
    return "FETCH_BLOCKED";
  }

  if (
    message.includes("empty extraction") ||
    message.includes("empty content") ||
    message.includes("extracted text is empty")
  ) {
    return "EXTRACT_EMPTY";
  }

  if (
    message.includes("unsupported format") ||
    message.includes("unsupported content-type") ||
    message.includes("not supported")
  ) {
    return "UNSUPPORTED_FORMAT";
  }

  return "UNKNOWN";
}
