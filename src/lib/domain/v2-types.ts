import type { DispositionLabel, JobStatusV2, JobTypeV2, SessionStatusV2 } from "@/lib/domain/v2-enums";

export interface SourceV2 {
  id: string;
  rssUrl: string;
  name?: string | null;
  tagsJson?: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SignalV2 {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  guid?: string | null;
  publishedAt?: Date | null;
  summary?: string | null;
  rawEntryJson: unknown;
  createdAt: Date;
}

export interface SignalDispositionV2 {
  id: string;
  signalId: string;
  label: DispositionLabel;
  isOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningSessionV2 {
  id: string;
  signalId: string;
  status: SessionStatusV2;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionMessageV2 {
  id: string;
  sessionId: string;
  role: "USER" | "ASSISTANT" | "TOOL";
  content: string;
  metaJson?: unknown;
  createdAt: Date;
}

export interface AsyncJobV2 {
  id: string;
  sessionId: string;
  type: JobTypeV2;
  status: JobStatusV2;
  error?: string | null;
  resultRefJson?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsightCardV2 {
  id: string;
  sessionId: string;
  signalId: string;
  insightJson: unknown;
  createdAt: Date;
}

export interface EvidencePackV2 {
  id: string;
  sessionId: string;
  signalId: string;
  packJson: unknown;
  createdAt: Date;
}
