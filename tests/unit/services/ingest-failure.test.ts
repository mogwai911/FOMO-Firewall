import { describe, expect, it } from "vitest";
import { classifyIngestionFailure } from "@/lib/services/ingest-failure";

describe("classifyIngestionFailure", () => {
  it("classifies timeout errors", () => {
    const code = classifyIngestionFailure(new Error("Request timeout after 10s"));
    expect(code).toBe("TIMEOUT");
  });

  it("classifies blocked fetch errors", () => {
    const code = classifyIngestionFailure(new Error("HTTP 403 forbidden blocked by cloudflare"));
    expect(code).toBe("FETCH_BLOCKED");
  });

  it("classifies empty extraction errors", () => {
    const code = classifyIngestionFailure(new Error("empty extraction content"));
    expect(code).toBe("EXTRACT_EMPTY");
  });

  it("classifies unsupported format errors", () => {
    const code = classifyIngestionFailure(new Error("unsupported format: pdf"));
    expect(code).toBe("UNSUPPORTED_FORMAT");
  });

  it("falls back to unknown", () => {
    const code = classifyIngestionFailure(new Error("something else"));
    expect(code).toBe("UNKNOWN");
  });
});
