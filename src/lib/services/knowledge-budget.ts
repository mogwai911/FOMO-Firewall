export interface WeeklyWindowUtc {
  start: Date;
  endExclusive: Date;
}

export interface WeeklyKnowledgeBudgetStatus {
  used: number;
  remaining: number;
  weeklyLimit: number;
  exceeded: boolean;
  window: WeeklyWindowUtc;
}

export interface KnowledgeBudgetDeps {
  countCardsInWindow: (window: WeeklyWindowUtc) => Promise<number>;
}

export function resolveWeeklyWindowUtc(now: Date): WeeklyWindowUtc {
  const day = now.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);

  const endExclusive = new Date(start);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);

  return { start, endExclusive };
}

export async function getWeeklyKnowledgeBudgetStatus(
  deps: KnowledgeBudgetDeps,
  options: {
    now?: Date;
    weeklyLimit?: number;
  } = {}
): Promise<WeeklyKnowledgeBudgetStatus> {
  const now = options.now ?? new Date();
  const weeklyLimit = options.weeklyLimit ?? 10;
  const window = resolveWeeklyWindowUtc(now);
  const used = await deps.countCardsInWindow(window);
  const remaining = Math.max(0, weeklyLimit - used);

  return {
    used,
    remaining,
    weeklyLimit,
    exceeded: used >= weeklyLimit,
    window
  };
}
