import { describe, expect, it } from "vitest";
import { resolveCollectAdapter, resolveAndNormalizeCollectInput } from "@/lib/collect/registry";

describe("collect registry", () => {
  it("resolves adapter by source type", () => {
    const urlAdapter = resolveCollectAdapter("URL");
    const textAdapter = resolveCollectAdapter("TEXT");

    expect(urlAdapter.type).toBe("URL");
    expect(textAdapter.type).toBe("TEXT");
  });

  it("normalizes URL input through URL adapter", () => {
    const out = resolveAndNormalizeCollectInput({
      url: " https://Example.com/path/?a=1#section "
    });

    expect(out.sourceType).toBe("URL");
    expect(out.url).toBe("https://example.com/path/?a=1");
  });

  it("normalizes TEXT input through text adapter", () => {
    const out = resolveAndNormalizeCollectInput({
      text: "  hello world  "
    });

    expect(out.sourceType).toBe("TEXT");
    expect(out.text).toBe("hello world");
  });
});
