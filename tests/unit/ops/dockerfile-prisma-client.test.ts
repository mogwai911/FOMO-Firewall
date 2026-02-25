import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const dockerfilePath = path.join(repoRoot, "Dockerfile");

describe("Dockerfile prisma client runtime wiring", () => {
  it("copies generated node_modules from builder stage into runner image", () => {
    const content = fs.readFileSync(dockerfilePath, "utf8");
    const runnerSection = content.split("FROM node:20-bookworm-slim AS runner")[1] ?? "";
    expect(runnerSection).toContain("COPY --from=builder /app/node_modules ./node_modules");
    expect(runnerSection).not.toContain("COPY --from=deps /app/node_modules ./node_modules");
  });
});
