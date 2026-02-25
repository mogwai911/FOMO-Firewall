"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import styles from "@/app/demo-ui.module.css";
import {
  AppApiError,
  fetchAppSettings,
  fetchProfile,
  saveAppSettings,
  saveProfile
} from "@/lib/client/app-api";
import type { AppSettingsView, RoleV2 } from "@/lib/client/app-types";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
  DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE
} from "@/lib/prompts/default-templates";

type SettingsSection = "profile" | "rss" | "schedule" | "api" | "prompts" | "data";

const SECTION_LABELS: Array<{ id: SettingsSection; label: string }> = [
  { id: "profile", label: "角色偏好" },
  { id: "rss", label: "订阅源" },
  { id: "schedule", label: "日报定时" },
  { id: "api", label: "LLM 接入" },
  { id: "prompts", label: "提示词" },
  { id: "data", label: "数据与导出" }
];

interface SourceView {
  id: string;
  rssUrl: string;
  name: string | null;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function defaultSettings(): AppSettingsView {
  return {
    schedule: {
      enabled: false,
      time: "09:00",
      timezone: detectTimezone()
    },
    apiConfig: {
      baseUrl: "",
      apiKey: "",
      model: DEFAULT_LLM_MODEL,
      hasApiKey: false,
      apiKeyMasked: null
    },
    prompts: {
      triage: DEFAULT_TRIAGE_PROMPT_TEMPLATE,
      sessionAssistant: DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
      suggestedQuestions: DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
    },
    updatedAt: new Date(0).toISOString()
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseError(json: unknown): string {
  if (!json || typeof json !== "object") {
    return "请求失败";
  }
  const maybeError = (json as { error?: unknown; message?: unknown }).message;
  if (typeof maybeError === "string" && maybeError.trim().length > 0) {
    return maybeError;
  }
  const code = (json as { error?: unknown }).error;
  return typeof code === "string" ? code : "请求失败";
}

export default function AppSettingsPage() {
  const [settings, setSettings] = useState<AppSettingsView>(defaultSettings);
  const [sources, setSources] = useState<SourceView[]>([]);

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rssUrl, setRssUrl] = useState("");
  const [rssName, setRssName] = useState("");
  const [rssTags, setRssTags] = useState("");
  const [rssBusyId, setRssBusyId] = useState<string | null>(null);
  const [rssLoading, setRssLoading] = useState(false);

  const [scheduleTimeDraft, setScheduleTimeDraft] = useState("09:00");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiModelDraft, setApiModelDraft] = useState(DEFAULT_LLM_MODEL);
  const [showApiKey, setShowApiKey] = useState(false);
  const [triagePromptDraft, setTriagePromptDraft] = useState("");
  const [sessionAssistantPromptDraft, setSessionAssistantPromptDraft] = useState("");
  const [suggestedQuestionsPromptDraft, setSuggestedQuestionsPromptDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState<RoleV2>("ENG");
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section");
    if (section === "rss") {
      setActiveSection("rss");
    }
  }, []);

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      try {
        const profile = await fetchProfile();
        setRoleDraft(profile.role);
      } catch {
        setRoleDraft("ENG");
      } finally {
        setProfileReady(true);
      }
    }

    void loadProfile();
  }, []);

  async function loadSources(): Promise<void> {
    setRssLoading(true);
    try {
      const res = await fetch("/api/sources", { cache: "no-store" });
      const json = (await res.json()) as { sources?: SourceView[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "LOAD_SOURCES_FAILED");
      }
      setSources(Array.isArray(json.sources) ? json.sources : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "LOAD_SOURCES_FAILED");
    } finally {
      setRssLoading(false);
    }
  }

  useEffect(() => {
    async function loadSettingsFromDb(): Promise<void> {
      try {
        const [remote] = await Promise.all([fetchAppSettings(), loadSources()]);
        setSettings(remote);
        setScheduleEnabled(remote.schedule.enabled);
        setScheduleTimeDraft(remote.schedule.time);
        setApiBaseUrlDraft(remote.apiConfig.baseUrl);
        setApiModelDraft(remote.apiConfig.model || DEFAULT_LLM_MODEL);
        setTriagePromptDraft(remote.prompts?.triage ?? DEFAULT_TRIAGE_PROMPT_TEMPLATE);
        setSessionAssistantPromptDraft(
          remote.prompts?.sessionAssistant ?? DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE
        );
        setSuggestedQuestionsPromptDraft(
          remote.prompts?.suggestedQuestions ?? DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
        );
      } catch {
        setSettings(defaultSettings());
      }
    }

    void loadSettingsFromDb();
  }, []);

  const enabledCount = useMemo(
    () => sources.filter((source) => source.enabled).length,
    [sources]
  );

  function showNotice(message: string): void {
    setToast(message);
    window.setTimeout(() => setToast(null), 1600);
  }

  async function handleAddRss(): Promise<void> {
    const normalized = rssUrl.trim();
    if (!isHttpUrl(normalized)) {
      setError("RSS URL 格式不合法，请输入 http(s) 地址。");
      return;
    }

    setError(null);
    const tags = rssTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        rssUrl: normalized,
        name: rssName.trim(),
        tags
      })
    });
    const json = (await res.json()) as unknown;
    if (!res.ok) {
      setError(parseError(json));
      return;
    }

    setRssUrl("");
    setRssName("");
    setRssTags("");
    showNotice("已添加订阅源");
    await loadSources();
  }

  async function handleToggle(source: SourceView): Promise<void> {
    setRssBusyId(source.id);
    setError(null);
    try {
      const res = await fetch(`/api/sources/${source.id}/toggle`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ enabled: !source.enabled })
      });
      const json = (await res.json()) as unknown;
      if (!res.ok) {
        throw new Error(parseError(json));
      }
      await loadSources();
      showNotice("已保存");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "SOURCE_TOGGLE_FAILED");
    } finally {
      setRssBusyId(null);
    }
  }

  async function handleDelete(sourceId: string): Promise<void> {
    setRssBusyId(sourceId);
    setError(null);
    try {
      const res = await fetch(`/api/sources/${sourceId}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as unknown;
      if (!res.ok) {
        throw new Error(parseError(json));
      }
      await loadSources();
      showNotice("已删除订阅源");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "SOURCE_DELETE_FAILED");
    } finally {
      setRssBusyId(null);
    }
  }

  async function saveSchedule(): Promise<void> {
    setError(null);
    try {
      const saved = await saveAppSettings({
        schedule: {
          enabled: scheduleEnabled,
          time: scheduleTimeDraft,
          timezone: settings.schedule.timezone
        },
        apiConfig: {
          baseUrl: settings.apiConfig.baseUrl,
          apiKey: "",
          model: settings.apiConfig.model
        },
        prompts: {
          triage: settings.prompts?.triage ?? DEFAULT_TRIAGE_PROMPT_TEMPLATE,
          sessionAssistant:
            settings.prompts?.sessionAssistant ??
            DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
          suggestedQuestions:
            settings.prompts?.suggestedQuestions ??
            DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
        }
      });
      setSettings(saved);
      setScheduleEnabled(saved.schedule.enabled);
      setScheduleTimeDraft(saved.schedule.time);
      showNotice("已保存");
    } catch (saveError) {
      if (saveError instanceof AppApiError) {
        setError(`${saveError.code}: ${saveError.message}`);
      } else {
        setError("SETTINGS_SCHEDULE_SAVE_FAILED");
      }
    }
  }

  async function saveApiConfig(): Promise<void> {
    const trimmed = apiBaseUrlDraft.trim();
    if (trimmed && !isHttpUrl(trimmed)) {
      setError("API Base URL 格式不合法。");
      return;
    }

    setError(null);
    try {
      const saved = await saveAppSettings({
        schedule: {
          enabled: settings.schedule.enabled,
          time: settings.schedule.time,
          timezone: settings.schedule.timezone
        },
        apiConfig: {
          baseUrl: trimmed,
          apiKey: apiKeyDraft.trim(),
          model: apiModelDraft.trim() || DEFAULT_LLM_MODEL
        },
        prompts: {
          triage: settings.prompts?.triage ?? DEFAULT_TRIAGE_PROMPT_TEMPLATE,
          sessionAssistant:
            settings.prompts?.sessionAssistant ??
            DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
          suggestedQuestions:
            settings.prompts?.suggestedQuestions ??
            DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
        }
      });

      setSettings(saved);
      setApiBaseUrlDraft(saved.apiConfig.baseUrl);
      setApiModelDraft(saved.apiConfig.model);
      setApiKeyDraft("");
      setShowApiKey(false);
      showNotice("已保存");
    } catch (saveError) {
      if (saveError instanceof AppApiError) {
        setError(`${saveError.code}: ${saveError.message}`);
      } else {
        setError("SETTINGS_API_SAVE_FAILED");
      }
    }
  }

  async function savePromptConfig(): Promise<void> {
    setError(null);
    try {
      const saved = await saveAppSettings({
        schedule: {
          enabled: settings.schedule.enabled,
          time: settings.schedule.time,
          timezone: settings.schedule.timezone
        },
        apiConfig: {
          baseUrl: settings.apiConfig.baseUrl,
          apiKey: "",
          model: settings.apiConfig.model
        },
        prompts: {
          triage: triagePromptDraft,
          sessionAssistant: sessionAssistantPromptDraft,
          suggestedQuestions: suggestedQuestionsPromptDraft
        }
      });
      setSettings(saved);
      setTriagePromptDraft(saved.prompts?.triage ?? DEFAULT_TRIAGE_PROMPT_TEMPLATE);
      setSessionAssistantPromptDraft(
        saved.prompts?.sessionAssistant ?? DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE
      );
      setSuggestedQuestionsPromptDraft(
        saved.prompts?.suggestedQuestions ?? DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
      );
      showNotice("提示词已保存");
    } catch (saveError) {
      if (saveError instanceof AppApiError) {
        setError(`${saveError.code}: ${saveError.message}`);
      } else {
        setError("SETTINGS_PROMPTS_SAVE_FAILED");
      }
    }
  }

  async function saveRolePreference(): Promise<void> {
    setError(null);
    try {
      await saveProfile({
        role: roleDraft
      });
      showNotice("角色偏好已保存");
    } catch (saveError) {
      if (saveError instanceof AppApiError) {
        setError(`${saveError.code}: ${saveError.message}`);
      } else {
        setError("PROFILE_SAVE_FAILED");
      }
    }
  }

  function exportSettings(): void {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            settings,
            sources
          },
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fomo-firewall-settings.json";
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  async function resetAll(): Promise<void> {
    const defaults = defaultSettings();
    setError(null);
    try {
      const saved = await saveAppSettings({
        schedule: defaults.schedule,
        apiConfig: defaults.apiConfig,
        prompts: defaults.prompts ?? {
          triage: DEFAULT_TRIAGE_PROMPT_TEMPLATE,
          sessionAssistant: DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE,
          suggestedQuestions: DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
        }
      });
      setSettings(saved);
      setScheduleTimeDraft(saved.schedule.time);
      setScheduleEnabled(saved.schedule.enabled);
      setApiBaseUrlDraft(saved.apiConfig.baseUrl);
      setApiModelDraft(saved.apiConfig.model);
      setApiKeyDraft("");
      setShowApiKey(false);
      setTriagePromptDraft(saved.prompts?.triage ?? DEFAULT_TRIAGE_PROMPT_TEMPLATE);
      setSessionAssistantPromptDraft(
        saved.prompts?.sessionAssistant ?? DEFAULT_SESSION_ASSISTANT_PROMPT_TEMPLATE
      );
      setSuggestedQuestionsPromptDraft(
        saved.prompts?.suggestedQuestions ?? DEFAULT_SUGGESTED_QUESTIONS_PROMPT_TEMPLATE
      );
      showNotice("已重置设置");
    } catch {
      setError("SETTINGS_RESET_FAILED");
    }
  }

  return (
    <AppShell active="settings" title="设置" subtitle="RSS/定时/LLM 配置均走真实 API 并入库。">
      <div className={styles.settingsLayout}>
        <aside className={styles.settingsNav} data-testid="settings-section-nav">
          {SECTION_LABELS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`${styles.settingsNavItem} ${activeSection === section.id ? styles.settingsNavItemActive : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </aside>

        <section className={styles.settingsContent}>
          {toast ? <p className={styles.ruleHint}>{toast}</p> : null}
          {error ? <p className={styles.formError}>{error}</p> : null}

          {activeSection === "profile" ? (
            <article className={styles.panel}>
              <h3>角色偏好（影响 triage 口吻）</h3>
              {!profileReady ? (
                <p className={styles.ruleHint}>加载角色偏好中...</p>
              ) : (
                <div className={styles.stack}>
                  <label className={styles.stack}>
                    <span>用户角色</span>
                    <select
                      aria-label="用户角色"
                      className={styles.input}
                      value={roleDraft}
                      onChange={(event) => setRoleDraft(event.target.value as RoleV2)}
                    >
                      <option value="PM">PM</option>
                      <option value="ENG">ENG</option>
                      <option value="RES">RES</option>
                    </select>
                  </label>
                  <button type="button" className={styles.btn} onClick={() => void saveRolePreference()}>
                    保存角色偏好
                  </button>
                </div>
              )}
            </article>
          ) : null}

          {activeSection === "rss" ? (
            <>
              <article className={styles.panel}>
                <h3>新增订阅源（入库）</h3>
                <div className={styles.stack}>
                  <input
                    className={styles.input}
                    value={rssUrl}
                    onChange={(event) => setRssUrl(event.target.value)}
                    placeholder="RSS URL（必填）"
                  />
                  <input
                    className={styles.input}
                    value={rssName}
                    onChange={(event) => setRssName(event.target.value)}
                    placeholder="显示名称（可选）"
                  />
                  <input
                    className={styles.input}
                    value={rssTags}
                    onChange={(event) => setRssTags(event.target.value)}
                    placeholder="标签（可选，逗号分隔）"
                  />
                  <div className={styles.actions}>
                    <button type="button" className={styles.btn} onClick={() => void handleAddRss()}>
                      添加订阅源
                    </button>
                  </div>
                </div>
              </article>

              <article className={styles.panel}>
                <div className={styles.inlineActions}>
                  <h3>订阅源列表（入库）</h3>
                  <p>
                    已启用 {enabledCount} / 总数 {sources.length}
                  </p>
                </div>

                {rssLoading ? <p className={styles.ruleHint}>加载中...</p> : null}

                {!rssLoading && sources.length === 0 ? (
                  <section className={styles.empty}>还没有订阅源。</section>
                ) : (
                  <ul className={styles.sourceListCompact}>
                    {sources.map((source) => (
                      <li key={source.id} className={styles.sourceItemCompact}>
                        <div className={styles.sourceMetaCompact}>
                          <strong>{source.name ?? source.rssUrl}</strong>
                          <p>{source.rssUrl}</p>
                          {source.tags.length > 0 ? (
                            <div className={styles.badgeRow}>
                              {source.tags.map((tag) => (
                                <span key={`${source.id}-${tag}`} className={styles.badge}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className={styles.inlineActions}>
                          <button
                            type="button"
                            className={styles.btn}
                            disabled={rssBusyId === source.id}
                            onClick={() => void handleToggle(source)}
                          >
                            {source.enabled ? "已启用" : "已禁用"}
                          </button>
                          <button
                            type="button"
                            className={styles.btnGhost}
                            disabled={rssBusyId === source.id}
                            onClick={() => void handleDelete(source.id)}
                          >
                            删除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </>
          ) : null}

          {activeSection === "schedule" ? (
            <article className={styles.panel}>
              <h3>日报定时</h3>
              <div className={styles.stack}>
                <label className={styles.inlineActions}>
                  <span>启用日报</span>
                  <input
                    type="checkbox"
                    aria-label="启用日报"
                    checked={scheduleEnabled}
                    onChange={(event) => setScheduleEnabled(event.target.checked)}
                  />
                </label>
                <label className={styles.stack}>
                  <span>触发时间</span>
                  <input
                    className={styles.input}
                    aria-label="触发时间"
                    type="time"
                    value={scheduleTimeDraft}
                    onChange={(event) => setScheduleTimeDraft(event.target.value)}
                  />
                </label>
                <button type="button" className={styles.btn} onClick={() => void saveSchedule()}>
                  保存定时
                </button>
              </div>
            </article>
          ) : null}

          {activeSection === "api" ? (
            <article className={styles.panel}>
              <h3>LLM 接入（用于 triage 与学习会话）</h3>
              <div className={styles.stack}>
                <input
                  className={styles.input}
                  value={apiBaseUrlDraft}
                  onChange={(event) => setApiBaseUrlDraft(event.target.value)}
                  placeholder="LLM Base URL（如 https://api.openai.com/v1）"
                />
                <input
                  className={styles.input}
                  value={apiModelDraft}
                  onChange={(event) => setApiModelDraft(event.target.value)}
                  placeholder="LLM 模型（如 gpt-4o-mini / o3-mini）"
                />
                <div className={styles.inlineActions}>
                  <input
                    className={styles.input}
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyDraft}
                    onChange={(event) => setApiKeyDraft(event.target.value)}
                    placeholder="LLM API Key（留空则沿用已保存值）"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setShowApiKey((value) => !value)}
                  >
                    {showApiKey ? "隐藏 API Key" : "显示 API Key"}
                  </button>
                </div>
                {settings.apiConfig.hasApiKey ? (
                  <p className={styles.ruleHint}>
                    已保存 API Key：{settings.apiConfig.apiKeyMasked ?? "已配置（已加密存储）"}
                  </p>
                ) : (
                  <p className={styles.ruleHint}>当前尚未保存 API Key。</p>
                )}
                <button type="button" className={styles.btn} onClick={() => void saveApiConfig()}>
                  保存 LLM 配置
                </button>
              </div>
            </article>
          ) : null}

          {activeSection === "prompts" ? (
            <article className={styles.panel}>
              <h3>提示词配置（影响分流、学习助手与提问助手）</h3>
              <div className={styles.stack}>
                <label className={styles.stack}>
                  <span>分流提示词</span>
                  <textarea
                    aria-label="分流提示词"
                    className={`${styles.input} ${styles.promptTextarea}`}
                    value={triagePromptDraft}
                    onChange={(event) => setTriagePromptDraft(event.target.value)}
                    placeholder="例如：你是严格的分流助手，优先可执行性与风险控制。可用变量：{{role}} {{title}} {{summary}} {{sourceName}} {{url}}"
                  />
                </label>
                <label className={styles.stack}>
                  <span>学习助手提示词</span>
                  <textarea
                    aria-label="学习助手提示词"
                    className={`${styles.input} ${styles.promptTextarea}`}
                    value={sessionAssistantPromptDraft}
                    onChange={(event) => setSessionAssistantPromptDraft(event.target.value)}
                    placeholder="例如：语气简洁，先给三步计划，再给风险检查。可用变量：{{signalTitle}} {{signalSummary}} {{signalUrl}} {{signalSourceName}} {{signalArticleExcerpt}}"
                  />
                </label>
                <label className={styles.stack}>
                  <span>提问提示词（你可能想问）</span>
                  <textarea
                    aria-label="提问提示词"
                    className={`${styles.input} ${styles.promptTextarea}`}
                    value={suggestedQuestionsPromptDraft}
                    onChange={(event) => setSuggestedQuestionsPromptDraft(event.target.value)}
                    placeholder='例如：只输出 JSON {"questions":[...]}，问题必须紧扣 feed 具体概念/方法/数据。可用变量：{{signalTitle}} {{signalSummary}} {{signalSourceName}} {{signalUrl}} {{signalArticleExcerpt}}'
                  />
                </label>
                <button type="button" className={styles.btn} onClick={() => void savePromptConfig()}>
                  保存提示词
                </button>
              </div>
            </article>
          ) : null}

          {activeSection === "data" ? (
            <article className={styles.panel}>
              <h3>数据与导出</h3>
              <div className={styles.actions}>
                <button type="button" className={styles.btn} onClick={exportSettings}>
                  导出设置
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => void resetAll()}>
                  重置定时与 API
                </button>
              </div>
            </article>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
