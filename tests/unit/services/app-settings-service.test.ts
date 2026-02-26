import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppSettingsServiceError,
  getAppSettings,
  saveAppSettings
} from "@/lib/services/app-settings-service";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
  DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE
} from "@/lib/prompts/default-templates";
import {
  encryptApiKeyValue,
  getSettingsEncryptionKey,
  isEncryptedApiKey
} from "@/lib/security/api-key-crypto";

describe("app-settings-service", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults when settings row does not exist", async () => {
    const deps = {
      findSingleton: vi.fn().mockResolvedValue(null),
      upsertSingleton: vi.fn().mockResolvedValue({
        id: "default",
        scheduleEnabled: false,
        scheduleTime: "09:00",
        timezone: "UTC",
        apiBaseUrl: "",
        apiKey: "",
        apiModel: "",
        triagePromptTemplate: "",
        sessionAssistantPromptTemplate: "",
        suggestedQuestionsPromptTemplate: "",
        updatedAt: new Date("2026-02-20T10:00:00.000Z")
      })
    };

    const out = await getAppSettings(deps as any);
    expect(out.schedule.time).toBe("09:00");
    expect(out.apiConfig.model).toBe(DEFAULT_LLM_MODEL);
    expect(out.prompts.triage).toBe(DEFAULT_TRIAGE_PROMPT_TEMPLATE);
    expect(out.prompts.sessionAssistant).toBe(
      DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE
    );
    expect(out.prompts.suggestedQuestions).toBe(
      DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
    );
    expect(deps.upsertSingleton).toHaveBeenCalledTimes(1);
  });

  it("falls back to default prompt presets for legacy empty templates", async () => {
    const deps = {
      findSingleton: vi.fn().mockResolvedValue({
        id: "default",
        scheduleEnabled: false,
        scheduleTime: "09:00",
        timezone: "UTC",
        apiBaseUrl: "",
        apiKey: "",
        apiModel: "",
        triagePromptTemplate: "",
        sessionAssistantPromptTemplate: "",
        suggestedQuestionsPromptTemplate: "",
        updatedAt: new Date("2026-02-20T10:00:00.000Z")
      }),
      upsertSingleton: vi.fn()
    };

    const out = await getAppSettings(deps as any);
    expect(out.prompts.triage).toBe(DEFAULT_TRIAGE_PROMPT_TEMPLATE);
    expect(out.prompts.sessionAssistant).toBe(
      DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE
    );
    expect(out.prompts.suggestedQuestions).toBe(
      DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
    );
    expect(deps.upsertSingleton).not.toHaveBeenCalled();
  });

  it("saves schedule and api settings", async () => {
    vi.stubEnv("APP_SETTINGS_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
    const deps = {
      findSingleton: vi.fn(),
      upsertSingleton: vi.fn().mockResolvedValue({
        id: "default",
        scheduleEnabled: true,
        scheduleTime: "08:30",
        timezone: "Asia/Shanghai",
        apiBaseUrl: "https://api.example.com",
        apiKey: "abc",
        apiModel: "o3-mini",
        triagePromptTemplate: "triage prompt",
        sessionAssistantPromptTemplate: "session prompt",
        suggestedQuestionsPromptTemplate: "questions prompt",
        updatedAt: new Date("2026-02-20T11:00:00.000Z")
      })
    };

    const out = await saveAppSettings(
      {
        schedule: {
          enabled: true,
          time: "08:30",
          timezone: "Asia/Shanghai"
        },
        apiConfig: {
          baseUrl: "https://api.example.com",
          apiKey: "abc",
          model: "o3-mini"
        },
        prompts: {
          triage: "triage prompt",
          sessionAssistant: "session prompt",
          suggestedQuestions: "questions prompt"
        }
      },
      deps as any
    );

    expect(out.schedule.enabled).toBe(true);
    expect(deps.upsertSingleton).toHaveBeenCalledWith({
      scheduleEnabled: true,
      scheduleTime: "08:30",
      timezone: "Asia/Shanghai",
      apiBaseUrl: "https://api.example.com",
      apiKey: expect.any(String),
      apiModel: "o3-mini",
      triagePromptTemplate: "triage prompt",
      sessionAssistantPromptTemplate: "session prompt",
      suggestedQuestionsPromptTemplate: "questions prompt"
    });
    const savedApiKey = deps.upsertSingleton.mock.calls[0][0].apiKey as string;
    expect(isEncryptedApiKey(savedApiKey)).toBe(true);
    expect(savedApiKey).not.toContain("abc");
    expect(out.apiConfig.model).toBe("o3-mini");
    expect(out.prompts.triage).toBe("triage prompt");
    expect(out.prompts.sessionAssistant).toBe("session prompt");
    expect(out.prompts.suggestedQuestions).toBe("questions prompt");
  });

  it("rejects invalid time format", async () => {
    const deps = {
      findSingleton: vi.fn(),
      upsertSingleton: vi.fn()
    };

    await expect(
      saveAppSettings(
        {
          schedule: {
            enabled: true,
            time: "8:3",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "",
            apiKey: "",
            model: ""
          },
          prompts: {
            triage: "",
            sessionAssistant: "",
            suggestedQuestions: ""
          }
        },
        deps as any
      )
    ).rejects.toMatchObject({ code: "INVALID_TIME" } as AppSettingsServiceError);
  });

  it("rejects saving api key when encryption key is missing", async () => {
    vi.stubEnv("APP_SETTINGS_ENCRYPTION_KEY", "");
    const deps = {
      findSingleton: vi.fn().mockResolvedValue(null),
      upsertSingleton: vi.fn()
    };

    await expect(
      saveAppSettings(
        {
          schedule: {
            enabled: false,
            time: "09:00",
            timezone: "UTC"
          },
          apiConfig: {
            baseUrl: "https://api.example.com/v1",
            apiKey: "sk-new-key",
            model: "gpt-4o-mini"
          },
          prompts: {
            triage: "triage prompt",
            sessionAssistant: "session prompt",
            suggestedQuestions: "questions prompt"
          }
        },
        deps as any
      )
    ).rejects.toMatchObject({
      code: "ENCRYPTION_KEY_MISSING"
    } as AppSettingsServiceError);
    expect(deps.upsertSingleton).not.toHaveBeenCalled();
  });

  it("keeps existing encrypted api key when payload apiKey is empty", async () => {
    vi.stubEnv("APP_SETTINGS_ENCRYPTION_KEY", Buffer.alloc(32, 13).toString("base64"));
    const existingEncrypted = encryptApiKeyValue(
      "sk-existing-123456",
      getSettingsEncryptionKey(process.env)
    );
    const deps = {
      findSingleton: vi.fn().mockResolvedValue({
        id: "default",
        scheduleEnabled: false,
        scheduleTime: "09:00",
        timezone: "UTC",
        apiBaseUrl: "https://api.example.com/v1",
        apiKey: existingEncrypted,
        apiModel: "gpt-4o-mini",
        triagePromptTemplate: "triage prompt",
        sessionAssistantPromptTemplate: "session prompt",
        suggestedQuestionsPromptTemplate: "questions prompt",
        updatedAt: new Date("2026-02-20T10:00:00.000Z")
      }),
      upsertSingleton: vi.fn().mockResolvedValue({
        id: "default",
        scheduleEnabled: false,
        scheduleTime: "09:00",
        timezone: "UTC",
        apiBaseUrl: "https://api.example.com/v1",
        apiKey: existingEncrypted,
        apiModel: "gpt-4o-mini",
        triagePromptTemplate: "triage prompt",
        sessionAssistantPromptTemplate: "session prompt",
        suggestedQuestionsPromptTemplate: "questions prompt",
        updatedAt: new Date("2026-02-20T10:00:00.000Z")
      })
    };

    await saveAppSettings(
      {
        schedule: {
          enabled: false,
          time: "09:00",
          timezone: "UTC"
        },
        apiConfig: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "",
          model: ""
        },
        prompts: {
          triage: "triage prompt",
          sessionAssistant: "session prompt",
          suggestedQuestions: "questions prompt"
        }
      },
      deps as any
    );

    expect(deps.upsertSingleton).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: existingEncrypted,
        apiModel: DEFAULT_LLM_MODEL
      })
    );
  });

  it("does not throw when stored api key cannot be decrypted with current key", async () => {
    const encryptedWithAnotherKey = encryptApiKeyValue(
      "sk-old",
      Buffer.alloc(32, 21)
    );
    vi.stubEnv("APP_SETTINGS_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const deps = {
      findSingleton: vi.fn().mockResolvedValue({
        id: "default",
        scheduleEnabled: false,
        scheduleTime: "09:00",
        timezone: "UTC",
        apiBaseUrl: "https://api.example.com/v1",
        apiKey: encryptedWithAnotherKey,
        apiModel: "gpt-4o-mini",
        triagePromptTemplate: "",
        sessionAssistantPromptTemplate: "",
        suggestedQuestionsPromptTemplate: "",
        updatedAt: new Date("2026-02-20T10:00:00.000Z")
      }),
      upsertSingleton: vi.fn()
    };

    const out = await getAppSettings(deps as any);
    expect(out.apiConfig.baseUrl).toBe("https://api.example.com/v1");
    expect(out.apiConfig.apiKey).toBe("");
  });
});
