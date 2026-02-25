export type SourceType = "URL" | "TEXT";

export type IngestionFailureCode =
  | "FETCH_BLOCKED"
  | "TIMEOUT"
  | "EXTRACT_EMPTY"
  | "UNSUPPORTED_FORMAT"
  | "UNKNOWN";

export interface CollectInput {
  url?: string;
  text?: string;
}

export interface NormalizedCollectPayload {
  sourceType: SourceType;
  url?: string;
  text?: string;
}

export interface CollectAdapter {
  type: SourceType;
  normalize(input: CollectInput): NormalizedCollectPayload;
}
