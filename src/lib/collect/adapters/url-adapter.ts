import type { CollectAdapter, CollectInput, NormalizedCollectPayload } from "@/lib/collect/types";

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const parsed = new URL(trimmed);
  parsed.hash = "";
  return parsed.toString();
}

export const urlAdapter: CollectAdapter = {
  type: "URL",
  normalize(input: CollectInput): NormalizedCollectPayload {
    const raw = input.url?.trim();
    if (!raw) {
      throw new Error("URL adapter requires a url");
    }

    return {
      sourceType: "URL",
      url: normalizeUrl(raw)
    };
  }
};
