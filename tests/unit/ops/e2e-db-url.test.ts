import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveE2EDatabaseUrl } = require("../../../scripts/e2e-db-url.js");

describe("e2e-db-url resolver", () => {
  it("defaults to isolated e2e sqlite db", () => {
    const out = resolveE2EDatabaseUrl({});
    expect(out).toBe("file:./e2e.db");
  });

  it("uses E2E_DATABASE_URL when provided", () => {
    const out = resolveE2EDatabaseUrl({
      E2E_DATABASE_URL: "file:./prisma/custom-e2e.db"
    });
    expect(out).toBe("file:./prisma/custom-e2e.db");
  });
});
