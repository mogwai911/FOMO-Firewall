import { DEFAULT_TRIAGE_PROMPT_TEMPLATE } from "@/lib/prompts/default-templates";

export interface TriagePromptInput {
  role: "PM" | "ENG" | "RES";
  title?: string | null;
  summary?: string | null;
  sourceName?: string | null;
  url?: string | null;
  extractedText: string;
  customPromptTemplate?: string | null;
  repair?: boolean;
  invalidPayload?: unknown;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => vars[key] ?? "");
}

export function buildTriagePrompt(input: TriagePromptInput): string {
  const template = input.customPromptTemplate?.trim() || DEFAULT_TRIAGE_PROMPT_TEMPLATE;
  const base = [
    applyTemplate(template, {
      role: input.role,
      title: input.title ?? "N/A",
      summary: input.summary ?? "N/A",
      sourceName: input.sourceName ?? "N/A",
      url: input.url ?? "N/A",
      extractedText: input.extractedText
    })
  ];

  if (input.repair) {
    base.push(
      "Previous output was invalid JSON/schema.",
      `Invalid payload: ${JSON.stringify(input.invalidPayload)}`
    );
  }

  return base.join("\n");
}
