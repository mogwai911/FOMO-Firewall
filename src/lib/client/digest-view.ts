import type { DispositionLabel } from "@/lib/client/app-types";

type DispositionView = DispositionLabel | "UNSET";

function pad2(input: number): string {
  return String(input).padStart(2, "0");
}

export function formatDigestPublishedAt(value: string | null): string {
  if (!value) {
    return "未知时间";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "未知时间";
  }

  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())} ${pad2(
    parsed.getHours()
  )}:00`;
}

export function formatSuggestionLabel(value: DispositionLabel): string {
  if (value === "FYI") return "稍后看";
  if (value === "DO") return "去学习";
  return "忽略";
}

export function formatDispositionLabel(value: DispositionView): string {
  if (value === "UNSET") return "未处理";
  return formatSuggestionLabel(value);
}

export function buildDigestResetConfirmMessage(): string {
  return [
    "要覆盖今日日报并重置处置状态吗？",
    "确定：覆盖日报，并将今日已处置线索重新标记为“待处理”",
    "取消：覆盖日报，但保留当前处置状态（推荐）"
  ].join("\n");
}
