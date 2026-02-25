import { textAdapter } from "@/lib/collect/adapters/text-adapter";
import { urlAdapter } from "@/lib/collect/adapters/url-adapter";
import type { CollectAdapter, CollectInput, NormalizedCollectPayload, SourceType } from "@/lib/collect/types";

const ADAPTERS: Record<SourceType, CollectAdapter> = {
  URL: urlAdapter,
  TEXT: textAdapter
};

export function resolveCollectAdapter(sourceType: SourceType): CollectAdapter {
  return ADAPTERS[sourceType];
}

export function resolveAndNormalizeCollectInput(input: CollectInput): NormalizedCollectPayload {
  if (input.url?.trim()) {
    return resolveCollectAdapter("URL").normalize(input);
  }

  if (input.text?.trim()) {
    return resolveCollectAdapter("TEXT").normalize(input);
  }

  throw new Error("Either url or text is required");
}
