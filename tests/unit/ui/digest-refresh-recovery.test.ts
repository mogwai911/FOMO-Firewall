import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("digest refresh recovery flow", () => {
  it("recovers in-flight refresh marker by polling status API", () => {
    const pagePath = resolve(process.cwd(), "src/app/app/digest/page.tsx");
    const source = readFileSync(pagePath, "utf-8");

    expect(source).toContain("readDigestRefreshMarker()");
    expect(source).toContain("fetchDigestStatus(marker.dateKey, marker.windowDays)");
    expect(source).toContain("DIGEST_REFRESH_STATUS_POLL_MS");
    expect(source).toContain("clearDigestRefreshMarker()");
  });
});
