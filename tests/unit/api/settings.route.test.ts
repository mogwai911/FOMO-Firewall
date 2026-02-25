import { describe, expect, it, vi } from "vitest";
import { createAppSettingsGetHandler, createAppSettingsPostHandler } from "@/app/api/settings/route";

describe("settings route", () => {
  it("GET returns settings", async () => {
    const getSettings = vi.fn().mockResolvedValue({
      schedule: {
        enabled: true,
        time: "08:30",
        timezone: "UTC"
      },
      apiConfig: {
        baseUrl: "https://api.example.com",
        apiKey: "abc",
        model: "gpt-4o-mini"
      },
      prompts: {
        triage: "triage prompt",
        sessionAssistant: "session prompt",
        suggestedQuestions: "questions prompt"
      }
    });
    const handler = createAppSettingsGetHandler({ getSettings } as any);

    const res = await handler();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings.schedule.enabled).toBe(true);
    expect(json.settings.apiConfig.apiKey).toBe("");
    expect(json.settings.apiConfig.hasApiKey).toBe(true);
    expect(json.settings.apiConfig.apiKeyMasked).toContain("*");
  });

  it("POST validates payload", async () => {
    const saveSettings = vi.fn();
    const handler = createAppSettingsPostHandler({ saveSettings } as any);
    const req = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schedule: {
          enabled: true,
          time: "bad-time",
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
      })
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("POST forwards valid payload", async () => {
    const saveSettings = vi.fn().mockResolvedValue({
      schedule: {
        enabled: false,
        time: "09:00",
        timezone: "UTC"
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        model: "o3-mini"
      },
      prompts: {
        triage: "triage prompt",
        sessionAssistant: "session prompt",
        suggestedQuestions: "questions prompt"
      }
    });
    const handler = createAppSettingsPostHandler({ saveSettings } as any);
    const req = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schedule: {
          enabled: false,
          time: "09:00",
          timezone: "UTC"
        },
        apiConfig: {
          baseUrl: "",
          apiKey: "",
          model: "o3-mini"
        },
        prompts: {
          triage: "triage prompt",
          sessionAssistant: "session prompt",
          suggestedQuestions: "questions prompt"
        }
      })
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(saveSettings).toHaveBeenCalledWith({
      schedule: {
        enabled: false,
        time: "09:00",
        timezone: "UTC"
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        model: "o3-mini"
      },
      prompts: {
        triage: "triage prompt",
        sessionAssistant: "session prompt",
        suggestedQuestions: "questions prompt"
      }
    });
    expect(json.settings.schedule.time).toBe("09:00");
    expect(json.settings.apiConfig.apiKey).toBe("");
    expect(json.settings.apiConfig.hasApiKey).toBe(false);
    expect(json.settings.apiConfig.apiKeyMasked).toBe(null);
  });
});
