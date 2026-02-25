import { describe, expect, it } from "vitest";
import { triageSchema } from "@/lib/domain/triage-schema";
import { defaultTriageProvider } from "@/lib/llm/triage-provider";

describe("defaultTriageProvider", () => {
  it("returns a schema-valid triage payload for local demo", async () => {
    const output = await defaultTriageProvider.generateTriage({
      role: "ENG",
      title: "Shipping API changes",
      url: "https://example.com/post",
      extractedText: "This post explains concrete migration steps and code samples."
    });

    const parsed = triageSchema.safeParse(output);
    expect(parsed.success).toBe(true);
  });
});
