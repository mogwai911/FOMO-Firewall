import { db } from "@/lib/db";

interface EvidencePackRow {
  id: string;
  sessionId: string | null;
  signalId: string;
  createdAt: Date;
  packJson: unknown;
  session: {
    messages: Array<{
      id: string;
      role: "USER" | "ASSISTANT" | "TOOL";
      content: string;
      createdAt: Date;
    }>;
  } | null;
}

interface EvidenceDeps {
  findEvidenceById: (evidenceId: string) => Promise<EvidencePackRow | null>;
}

export class EvidenceServiceError extends Error {
  code: "EVIDENCE_NOT_FOUND";

  constructor(code: "EVIDENCE_NOT_FOUND", message: string) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): EvidenceDeps {
  return {
    findEvidenceById: (evidenceId) =>
      db.evidencePack.findUnique({
        where: { id: evidenceId },
        select: {
          id: true,
          sessionId: true,
          signalId: true,
          createdAt: true,
          packJson: true,
          session: {
            select: {
              messages: {
                orderBy: {
                  createdAt: "asc"
                },
                select: {
                  id: true,
                  role: true,
                  content: true,
                  createdAt: true
                }
              }
            }
          }
        }
      })
  };
}

interface EvidencePackJson {
  summary?: unknown;
  key_quotes?: unknown;
  links?: unknown;
  trace?: unknown;
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((value): value is string => typeof value === "string");
}

export async function getEvidencePackDetail(
  evidenceId: string,
  deps: EvidenceDeps = defaultDeps()
): Promise<{
  id: string;
  sessionId: string | null;
  sessionAvailable: boolean;
  signalId: string;
  createdAt: string;
  summary: string;
  keyQuotes: string[];
  links: string[];
  trace: unknown;
  transcript: Array<{
    id: string;
    role: "USER" | "ASSISTANT" | "TOOL";
    content: string;
    createdAt: string;
  }>;
}> {
  const row = await deps.findEvidenceById(evidenceId);
  if (!row) {
    throw new EvidenceServiceError("EVIDENCE_NOT_FOUND", "evidence pack not found");
  }

  const packJson = (row.packJson ?? {}) as EvidencePackJson;
  const summary = typeof packJson.summary === "string" ? packJson.summary : "";

  return {
    id: row.id,
    sessionId: row.sessionId,
    sessionAvailable: Boolean(row.sessionId),
    signalId: row.signalId,
    createdAt: row.createdAt.toISOString(),
    summary,
    keyQuotes: toStringArray(packJson.key_quotes),
    links: toStringArray(packJson.links),
    trace: packJson.trace ?? null,
    transcript: (row.session?.messages ?? []).map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString()
    }))
  };
}
