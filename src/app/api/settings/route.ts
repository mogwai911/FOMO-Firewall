import {
  type AppSettingsView,
  AppSettingsServiceError,
  getAppSettings,
  saveAppSettings
} from "@/lib/services/app-settings-service";

interface SettingsRouteDeps {
  getSettings: typeof getAppSettings;
  saveSettings: typeof saveAppSettings;
}

function maskApiKey(apiKey: string): string | null {
  const value = apiKey.trim();
  if (!value) {
    return null;
  }
  if (value.length <= 6) {
    return `${value.slice(0, 1)}***${value.slice(-1)}`;
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function toPublicSettings(settings: AppSettingsView): AppSettingsView & {
  apiConfig: AppSettingsView["apiConfig"] & {
    hasApiKey: boolean;
    apiKeyMasked: string | null;
  };
} {
  const hasApiKey = settings.apiConfig.apiKey.trim().length > 0;
  return {
    ...settings,
    apiConfig: {
      ...settings.apiConfig,
      apiKey: "",
      hasApiKey,
      apiKeyMasked: hasApiKey ? maskApiKey(settings.apiConfig.apiKey) : null
    }
  };
}

interface SettingsBody {
  schedule?: {
    enabled?: unknown;
    time?: unknown;
    timezone?: unknown;
  };
  apiConfig?: {
    baseUrl?: unknown;
    apiKey?: unknown;
    model?: unknown;
  };
  prompts?: {
    triage?: unknown;
    sessionAssistant?: unknown;
    suggestedQuestions?: unknown;
  };
}

function parseBody(body: SettingsBody): {
  schedule: { enabled: boolean; time: string; timezone: string };
  apiConfig: { baseUrl: string; apiKey: string; model: string };
  prompts?: { triage: string; sessionAssistant: string; suggestedQuestions?: string };
} | null {
  if (!body.schedule || !body.apiConfig) {
    return null;
  }
  if (typeof body.schedule.enabled !== "boolean") {
    return null;
  }
  if (typeof body.schedule.time !== "string") {
    return null;
  }
  if (typeof body.schedule.timezone !== "string") {
    return null;
  }
  if (typeof body.apiConfig.baseUrl !== "string") {
    return null;
  }
  if (typeof body.apiConfig.apiKey !== "string") {
    return null;
  }
  if (typeof body.apiConfig.model !== "string") {
    return null;
  }
  if (body.prompts !== undefined) {
    if (typeof body.prompts.triage !== "string") {
      return null;
    }
    if (typeof body.prompts.sessionAssistant !== "string") {
      return null;
    }
    if (
      body.prompts.suggestedQuestions !== undefined &&
      typeof body.prompts.suggestedQuestions !== "string"
    ) {
      return null;
    }
  }
  if (!/^\d{2}:\d{2}$/.test(body.schedule.time)) {
    return null;
  }
  const parsed: {
    schedule: { enabled: boolean; time: string; timezone: string };
    apiConfig: { baseUrl: string; apiKey: string; model: string };
    prompts?: { triage: string; sessionAssistant: string; suggestedQuestions?: string };
  } = {
    schedule: {
      enabled: body.schedule.enabled,
      time: body.schedule.time,
      timezone: body.schedule.timezone
    },
    apiConfig: {
      baseUrl: body.apiConfig.baseUrl,
      apiKey: body.apiConfig.apiKey,
      model: body.apiConfig.model
    }
  };
  if (body.prompts) {
    parsed.prompts = {
      triage: body.prompts.triage as string,
      sessionAssistant: body.prompts.sessionAssistant as string,
      suggestedQuestions:
        typeof body.prompts.suggestedQuestions === "string"
          ? body.prompts.suggestedQuestions
          : undefined
    };
  }
  return parsed;
}

export function createAppSettingsGetHandler(
  deps: SettingsRouteDeps = {
    getSettings: getAppSettings,
    saveSettings: saveAppSettings
  }
) {
  return async function GET(): Promise<Response> {
    try {
      const settings = await deps.getSettings();
      return Response.json({ settings: toPublicSettings(settings) });
    } catch (error) {
      if (error instanceof AppSettingsServiceError) {
        return Response.json({ error: error.code, message: error.message }, { status: 400 });
      }
      return Response.json({ error: "SETTINGS_GET_FAILED" }, { status: 500 });
    }
  };
}

export function createAppSettingsPostHandler(
  deps: SettingsRouteDeps = {
    getSettings: getAppSettings,
    saveSettings: saveAppSettings
  }
) {
  return async function POST(request: Request): Promise<Response> {
    let body: SettingsBody;
    try {
      body = (await request.json()) as SettingsBody;
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const parsed = parseBody(body);
    if (!parsed) {
      return Response.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    try {
      const settings = await deps.saveSettings(parsed);
      return Response.json({ settings: toPublicSettings(settings) });
    } catch (error) {
      if (error instanceof AppSettingsServiceError) {
        return Response.json({ error: error.code, message: error.message }, { status: 400 });
      }
      return Response.json({ error: "SETTINGS_SAVE_FAILED" }, { status: 500 });
    }
  };
}

export const GET = createAppSettingsGetHandler();
export const POST = createAppSettingsPostHandler();
