import type { CollectAdapter, CollectInput, NormalizedCollectPayload } from "@/lib/collect/types";

export const textAdapter: CollectAdapter = {
  type: "TEXT",
  normalize(input: CollectInput): NormalizedCollectPayload {
    const raw = input.text?.trim();
    if (!raw) {
      throw new Error("TEXT adapter requires text");
    }

    return {
      sourceType: "TEXT",
      text: raw
    };
  }
};
