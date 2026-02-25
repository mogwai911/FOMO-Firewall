import {
  generateHeuristicTriageCard,
  type RoleV2,
  type TriageCardV2,
  type TriageSignalInput
} from "@/lib/agent/triage-agent";
import { db } from "@/lib/db";
import { resolveTriageCardProvider } from "@/lib/llm/triage-card-provider";
import { createAppStorage } from "@/lib/storage/app-storage";
import type { Prisma } from "@prisma/client";

export type { RoleV2, TriageCardV2, TriageSignalInput } from "@/lib/agent/triage-agent";

interface SignalRecord {
  id: string;
  title: string;
  summary: string | null;
  source: {
    name: string | null;
  };
}

interface TriageDeps {
  findSignal: (signalId: string) => Promise<SignalRecord | null>;
  generateCard: (input: {
    role: RoleV2;
    title: string;
    summary: string | null;
    sourceName: string | null;
    promptTemplate?: string;
  }) => Promise<TriageCardV2>;
  createTriage: (input: {
    signalId: string;
    role: RoleV2;
    triageJson: Prisma.InputJsonValue;
  }) => Promise<{ id: string; triageJson: unknown }>;
}

export class SignalTriageServiceError extends Error {
  code: "SIGNAL_NOT_FOUND" | "INVALID_ROLE";

  constructor(code: "SIGNAL_NOT_FOUND" | "INVALID_ROLE", message: string) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): TriageDeps {
  const storage = createAppStorage();
  return {
    findSignal: (signalId) => storage.findSignalForTriage(signalId),
    generateCard: async (input) => {
      const appSettings = await db.appSettings.findUnique({
        where: {
          id: "default"
        },
        select: {
          apiBaseUrl: true,
          apiKey: true,
          apiModel: true,
          triagePromptTemplate: true
        }
      });

      const provider = resolveTriageCardProvider({
        mode: appSettings?.apiBaseUrl ? "remote" : undefined,
        url: appSettings?.apiBaseUrl ?? undefined,
        apiKey: appSettings?.apiKey ?? undefined,
        model: appSettings?.apiModel ?? undefined
      });
      return provider.generate({
        ...input,
        promptTemplate: appSettings?.triagePromptTemplate ?? ""
      });
    },
    createTriage: (input) => storage.createSignalTriage(input)
  };
}

const ROLE_SET = new Set<RoleV2>(["PM", "ENG", "RES"]);

export function isValidRoleV2(value: unknown): value is RoleV2 {
  return typeof value === "string" && ROLE_SET.has(value as RoleV2);
}

export function buildTriageCard(signal: TriageSignalInput, role: RoleV2): TriageCardV2 {
  return generateHeuristicTriageCard(signal, role);
}

export async function generateTriageForSignal(
  input: { signalId: string; role: RoleV2 },
  deps: TriageDeps = defaultDeps()
): Promise<{ triageId: string; triage: TriageCardV2 }> {
  if (!isValidRoleV2(input.role)) {
    throw new SignalTriageServiceError("INVALID_ROLE", "invalid role");
  }

  const signal = await deps.findSignal(input.signalId);
  if (!signal) {
    throw new SignalTriageServiceError("SIGNAL_NOT_FOUND", "signal not found");
  }

  let generated: TriageCardV2;
  try {
    generated = await deps.generateCard({
      role: input.role,
      title: signal.title,
      summary: signal.summary,
      sourceName: signal.source.name
    });
  } catch {
    generated = buildTriageCard(
      {
        title: signal.title,
        summary: signal.summary,
        sourceName: signal.source.name
      },
      input.role
    );
  }

  const created = await deps.createTriage({
    signalId: signal.id,
    role: input.role,
    triageJson: generated as unknown as Prisma.InputJsonValue
  });

  return {
    triageId: created.id,
    triage: generated
  };
}
