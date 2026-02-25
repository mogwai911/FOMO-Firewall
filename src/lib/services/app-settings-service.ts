import { db } from "@/lib/db";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
  DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE
} from "@/lib/prompts/default-templates";
import {
  ApiKeyCryptoError,
  decryptApiKeyValue,
  encryptApiKeyValue,
  getSettingsEncryptionKey,
  isEncryptedApiKey
} from "@/lib/security/api-key-crypto";

interface AppSettingsRow {
  id: string;
  scheduleEnabled: boolean;
  scheduleTime: string;
  timezone: string;
  apiBaseUrl: string | null;
  apiKey: string | null;
  apiModel: string | null;
  triagePromptTemplate: string | null;
  sessionAssistantPromptTemplate: string | null;
  suggestedQuestionsPromptTemplate: string | null;
  updatedAt: Date;
}

interface AppSettingsDeps {
  findSingleton: () => Promise<AppSettingsRow | null>;
  upsertSingleton: (input: {
    scheduleEnabled: boolean;
    scheduleTime: string;
    timezone: string;
    apiBaseUrl: string;
    apiKey: string;
    apiModel: string;
    triagePromptTemplate: string;
    sessionAssistantPromptTemplate: string;
    suggestedQuestionsPromptTemplate: string;
  }) => Promise<AppSettingsRow>;
}

export interface AppSettingsView {
  schedule: {
    enabled: boolean;
    time: string;
    timezone: string;
  };
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  prompts: {
    triage: string;
    sessionAssistant: string;
    suggestedQuestions: string;
  };
  updatedAt: string;
}

export class AppSettingsServiceError extends Error {
  code:
    | "INVALID_TIME"
    | "INVALID_API_BASE_URL"
    | "ENCRYPTION_KEY_MISSING"
    | "ENCRYPTION_KEY_INVALID"
    | "API_KEY_DECRYPT_FAILED";

  constructor(
    code:
      | "INVALID_TIME"
      | "INVALID_API_BASE_URL"
      | "ENCRYPTION_KEY_MISSING"
      | "ENCRYPTION_KEY_INVALID"
      | "API_KEY_DECRYPT_FAILED",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

function defaultDeps(): AppSettingsDeps {
  return {
    findSingleton: () =>
      db.appSettings.findUnique({
        where: {
          id: "default"
        }
      }),
    upsertSingleton: (input) =>
      db.appSettings.upsert({
        where: {
          id: "default"
        },
        create: {
          id: "default",
          ...input
        },
        update: {
          ...input
        }
      })
  };
}

function normalizeTime(time: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new AppSettingsServiceError("INVALID_TIME", "time must use HH:mm format");
  }
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new AppSettingsServiceError("INVALID_TIME", "time must use HH:mm format");
  }
  return `${hourStr}:${minuteStr}`;
}

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid");
    }
    return trimmed;
  } catch {
    throw new AppSettingsServiceError("INVALID_API_BASE_URL", "api base url must be http(s)");
  }
}

function normalizeTimezone(value: string): string {
  const trimmed = value.trim();
  return trimmed || "UTC";
}

function resolveDefaultModel(): string {
  return process.env.TRIAGE_LLM_MODEL?.trim() || DEFAULT_LLM_MODEL;
}

function toSettingsServiceError(error: unknown): AppSettingsServiceError {
  if (error instanceof ApiKeyCryptoError) {
    return new AppSettingsServiceError(error.code, error.message);
  }
  if (error instanceof AppSettingsServiceError) {
    return error;
  }
  return new AppSettingsServiceError("API_KEY_DECRYPT_FAILED", "API_KEY_DECRYPT_FAILED");
}

function decryptStoredApiKey(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (!isEncryptedApiKey(raw)) {
    return raw;
  }
  try {
    return decryptApiKeyValue(raw, getSettingsEncryptionKey());
  } catch (error) {
    throw toSettingsServiceError(error);
  }
}

function resolveApiKeyToPersist(inputApiKey: string, existingStoredApiKey?: string | null): string {
  const nextPlain = inputApiKey.trim();
  if (!nextPlain) {
    return (existingStoredApiKey ?? "").trim();
  }
  try {
    const encrypted = encryptApiKeyValue(nextPlain, getSettingsEncryptionKey());
    return encrypted;
  } catch (error) {
    throw toSettingsServiceError(error);
  }
}

function mapRow(row: AppSettingsRow): AppSettingsView {
  return {
    schedule: {
      enabled: row.scheduleEnabled,
      time: row.scheduleTime,
      timezone: row.timezone
    },
    apiConfig: {
      baseUrl: row.apiBaseUrl ?? "",
      apiKey: decryptStoredApiKey(row.apiKey),
      model: normalizePromptTemplate(row.apiModel, resolveDefaultModel())
    },
    prompts: {
      triage: normalizePromptTemplate(
        row.triagePromptTemplate,
        DEFAULT_TRIAGE_PROMPT_TEMPLATE
      ),
      sessionAssistant: normalizePromptTemplate(
        row.sessionAssistantPromptTemplate,
        DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE
      ),
      suggestedQuestions: normalizePromptTemplate(
        row.suggestedQuestionsPromptTemplate,
        DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
      )
    },
    updatedAt: row.updatedAt.toISOString()
  };
}

function normalizePromptTemplate(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed;
}

export async function getAppSettings(deps: AppSettingsDeps = defaultDeps()): Promise<AppSettingsView> {
  const existing = await deps.findSingleton();
  if (existing) {
    return mapRow(existing);
  }

  const created = await deps.upsertSingleton({
    scheduleEnabled: false,
    scheduleTime: "09:00",
    timezone: "UTC",
    apiBaseUrl: "",
    apiKey: "",
    apiModel: resolveDefaultModel(),
    triagePromptTemplate: DEFAULT_TRIAGE_PROMPT_TEMPLATE,
    sessionAssistantPromptTemplate: DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
    suggestedQuestionsPromptTemplate: DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
  });
  return mapRow(created);
}

export async function saveAppSettings(
  input: {
    schedule: {
      enabled: boolean;
      time: string;
      timezone: string;
    };
    apiConfig: {
      baseUrl: string;
      apiKey: string;
      model: string;
    };
    prompts?: {
      triage: string;
      sessionAssistant: string;
      suggestedQuestions?: string;
    };
  },
  deps: AppSettingsDeps = defaultDeps()
): Promise<AppSettingsView> {
  const existing = await deps.findSingleton();
  const row = await deps.upsertSingleton({
    scheduleEnabled: input.schedule.enabled,
    scheduleTime: normalizeTime(input.schedule.time),
    timezone: normalizeTimezone(input.schedule.timezone),
    apiBaseUrl: normalizeApiBaseUrl(input.apiConfig.baseUrl),
    apiKey: resolveApiKeyToPersist(input.apiConfig.apiKey, existing?.apiKey),
    apiModel: normalizePromptTemplate(input.apiConfig.model, resolveDefaultModel()),
    triagePromptTemplate: normalizePromptTemplate(
      input.prompts?.triage ?? existing?.triagePromptTemplate,
      DEFAULT_TRIAGE_PROMPT_TEMPLATE
    ),
    sessionAssistantPromptTemplate: normalizePromptTemplate(
      input.prompts?.sessionAssistant ?? existing?.sessionAssistantPromptTemplate,
      DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE
    ),
    suggestedQuestionsPromptTemplate: normalizePromptTemplate(
      input.prompts?.suggestedQuestions ?? existing?.suggestedQuestionsPromptTemplate,
      DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
    )
  });
  return mapRow(row);
}
