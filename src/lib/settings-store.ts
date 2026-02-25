import type { MockSettings, RssSourceSetting } from "@/lib/mockStore";

export const SETTINGS_STORAGE_KEY = "fomo_firewall_settings_v1";
export const SETTINGS_STORAGE_VERSION = 1;

interface SettingsPersistedPayload {
  version: number;
  settings: MockSettings;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getDefaultSettings(): MockSettings {
  return {
    rssSources: [],
    schedule: {
      enabled: false,
      time: "09:00",
      timezone: detectTimezone()
    },
    apiConfig: {
      baseUrl: "",
      apiKey: ""
    }
  };
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeRssSourceList(value: unknown): RssSourceSetting[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null;
      }

      const url = typeof entry.url === "string" ? entry.url.trim() : "";
      if (!url || !isValidHttpUrl(url)) {
        return null;
      }

      const id =
        typeof entry.id === "string" && entry.id.trim().length > 0
          ? entry.id.trim()
          : `rss-${index + 1}`;
      const name =
        typeof entry.name === "string" && entry.name.trim().length > 0
          ? entry.name.trim()
          : url;
      const enabled = typeof entry.enabled === "boolean" ? entry.enabled : true;
      const createdAt =
        typeof entry.createdAt === "string" && entry.createdAt.trim().length > 0
          ? entry.createdAt
          : new Date().toISOString();
      const tags = Array.isArray(entry.tags)
        ? entry.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
        : [];

      return {
        id,
        name,
        url,
        tags,
        enabled,
        createdAt
      };
    })
    .filter((entry): entry is RssSourceSetting => Boolean(entry));
}

function sanitizeSettings(value: unknown): MockSettings | null {
  if (!isRecord(value)) {
    return null;
  }

  const defaults = getDefaultSettings();
  const rssSources = sanitizeRssSourceList(value.rssSources);

  const scheduleRaw = isRecord(value.schedule) ? value.schedule : {};
  const schedule = {
    enabled:
      typeof scheduleRaw.enabled === "boolean" ? scheduleRaw.enabled : defaults.schedule.enabled,
    time:
      typeof scheduleRaw.time === "string" && /^\d{2}:\d{2}$/.test(scheduleRaw.time)
        ? scheduleRaw.time
        : defaults.schedule.time,
    timezone:
      typeof scheduleRaw.timezone === "string" && scheduleRaw.timezone.trim().length > 0
        ? scheduleRaw.timezone
        : defaults.schedule.timezone
  };

  const apiRaw = isRecord(value.apiConfig) ? value.apiConfig : {};
  const apiConfig = {
    baseUrl: typeof apiRaw.baseUrl === "string" ? apiRaw.baseUrl.trim() : "",
    apiKey: typeof apiRaw.apiKey === "string" ? apiRaw.apiKey : ""
  };

  return {
    rssSources,
    schedule,
    apiConfig
  };
}

export function readPersistedSettings(storage: StorageLike | null = getBrowserStorage()): MockSettings | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const version = parsed.version;
    if (typeof version !== "number" || version !== SETTINGS_STORAGE_VERSION) {
      return null;
    }

    return sanitizeSettings(parsed.settings);
  } catch {
    return null;
  }
}

export function writePersistedSettings(
  settings: MockSettings,
  storage: StorageLike | null = getBrowserStorage()
): void {
  if (!storage) {
    return;
  }

  const payload: SettingsPersistedPayload = {
    version: SETTINGS_STORAGE_VERSION,
    settings
  };

  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore client storage failures for prototype mode.
  }
}

export function clearPersistedSettings(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
    // Ignore cleanup failures for prototype mode.
  }
}
