import { describe, expect, it } from "vitest";
import {
  SETTINGS_STORAGE_KEY,
  SETTINGS_STORAGE_VERSION,
  clearPersistedSettings,
  readPersistedSettings,
  writePersistedSettings,
  type StorageLike
} from "@/lib/settings-store";

function createMemoryStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(seed));

  return {
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key) ?? null : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
    removeItem(key: string): void {
      map.delete(key);
    }
  };
}

describe("settings-store", () => {
  it("persists and restores settings payload", () => {
    const storage = createMemoryStorage();
    const settings = {
      rssSources: [
        {
          id: "rss-1",
          name: "HN",
          url: "https://news.ycombinator.com/rss",
          tags: ["tech"],
          enabled: true,
          createdAt: "2026-02-20T00:00:00.000Z"
        }
      ],
      schedule: {
        enabled: true,
        time: "08:30",
        timezone: "UTC"
      },
      apiConfig: {
        baseUrl: "https://api.example.com",
        apiKey: "secret"
      }
    };

    writePersistedSettings(settings, storage);
    expect(readPersistedSettings(storage)).toEqual(settings);
  });

  it("returns null for version mismatch", () => {
    const storage = createMemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        version: SETTINGS_STORAGE_VERSION + 1,
        settings: {}
      })
    });

    expect(readPersistedSettings(storage)).toBeNull();
  });

  it("clears persisted settings", () => {
    const storage = createMemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        version: SETTINGS_STORAGE_VERSION,
        settings: {
          rssSources: [],
          schedule: { enabled: false, time: "09:00", timezone: "UTC" },
          apiConfig: { baseUrl: "", apiKey: "" }
        }
      })
    });

    clearPersistedSettings(storage);
    expect(readPersistedSettings(storage)).toBeNull();
  });
});
