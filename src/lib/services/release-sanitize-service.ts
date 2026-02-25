import { db } from "@/lib/db";
import {
  DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
  DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE
} from "@/lib/prompts/default-templates";

export const RELEASE_DEFAULT_SOURCES: Array<{
  rssUrl: string;
  name: string;
  tags: string[];
}> = [
  {
    rssUrl: "https://www.jiqizhixin.com/rss",
    name: "机器之心",
    tags: ["ai", "china"]
  },
  {
    rssUrl: "https://www.qbitai.com/feed",
    name: "量子位",
    tags: ["ai", "china"]
  }
];

interface ReleaseSourceRow {
  id: string;
  rssUrl: string;
  name: string | null;
  tagsJson: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ReleaseSettingsRow {
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

interface ReleaseSanitizeDeps {
  listSources: () => Promise<ReleaseSourceRow[]>;
  createSource: (input: { rssUrl: string; name: string; tags: string[] }) => Promise<void>;
  findSettings: () => Promise<ReleaseSettingsRow | null>;
  upsertSettings: (input: {
    scheduleEnabled: boolean;
    scheduleTime: string;
    timezone: string;
    apiBaseUrl: string;
    apiKey: string;
    apiModel: string;
    triagePromptTemplate: string;
    sessionAssistantPromptTemplate: string;
    suggestedQuestionsPromptTemplate: string;
  }) => Promise<void>;
}

function defaultDeps(): ReleaseSanitizeDeps {
  return {
    listSources: () => db.source.findMany(),
    createSource: async (input) => {
      await db.source.create({
        data: {
          rssUrl: input.rssUrl,
          name: input.name,
          tagsJson: input.tags,
          enabled: true
        }
      });
    },
    findSettings: () =>
      db.appSettings.findUnique({
        where: {
          id: "default"
        }
      }),
    upsertSettings: async (input) => {
      await db.appSettings.upsert({
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
      });
    }
  };
}

function keepOrFallback(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

export async function sanitizeReleaseState(
  deps: ReleaseSanitizeDeps = defaultDeps()
): Promise<{ addedDefaultSources: number; llmConfigCleared: true }> {
  const existingSources = await deps.listSources();
  const existingUrls = new Set(existingSources.map((source) => source.rssUrl));
  let addedDefaultSources = 0;

  for (const source of RELEASE_DEFAULT_SOURCES) {
    if (existingUrls.has(source.rssUrl)) {
      continue;
    }
    await deps.createSource(source);
    addedDefaultSources += 1;
  }

  const settings = await deps.findSettings();
  if (!settings) {
    await deps.upsertSettings({
      scheduleEnabled: false,
      scheduleTime: "09:00",
      timezone: "UTC",
      apiBaseUrl: "",
      apiKey: "",
      apiModel: "",
      triagePromptTemplate: DEFAULT_TRIAGE_PROMPT_TEMPLATE,
      sessionAssistantPromptTemplate: DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
      suggestedQuestionsPromptTemplate: DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
    });
  } else {
    await deps.upsertSettings({
      scheduleEnabled: settings.scheduleEnabled,
      scheduleTime: settings.scheduleTime,
      timezone: settings.timezone,
      apiBaseUrl: "",
      apiKey: "",
      apiModel: "",
      triagePromptTemplate: keepOrFallback(
        settings.triagePromptTemplate,
        DEFAULT_TRIAGE_PROMPT_TEMPLATE
      ),
      sessionAssistantPromptTemplate: keepOrFallback(
        settings.sessionAssistantPromptTemplate,
        DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE
      ),
      suggestedQuestionsPromptTemplate: keepOrFallback(
        settings.suggestedQuestionsPromptTemplate,
        DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
      )
    });
  }

  return {
    addedDefaultSources,
    llmConfigCleared: true
  };
}
