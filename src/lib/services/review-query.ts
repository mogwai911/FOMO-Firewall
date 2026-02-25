import { db } from "@/lib/db";

export interface ReviewItem {
  itemId: string;
  title: string | null;
  url: string | null;
  status: string;
  dueAt: string;
  relevance: "MARK_RELEVANT" | "MARK_NOT_RELEVANT" | null;
  deferredButImportant: boolean;
}

function plusDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export async function queryReview(
  deps: { db: typeof db; now?: Date } = { db }
): Promise<ReviewItem[]> {
  const now = deps.now ?? new Date();

  const remindEvents = await deps.db.eventLog.findMany({
    where: { eventType: "REMIND_7D" },
    select: { itemId: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });

  const dueByItem = new Map<string, Date>();
  for (const event of remindEvents) {
    const dueAt = plusDays(event.createdAt, 7);
    if (dueAt > now) {
      continue;
    }
    if (!dueByItem.has(event.itemId)) {
      dueByItem.set(event.itemId, dueAt);
    }
  }

  const dueItemIds = [...dueByItem.keys()];
  if (dueItemIds.length === 0) {
    return [];
  }

  const [items, relevanceEvents] = await Promise.all([
    deps.db.item.findMany({
      where: { id: { in: dueItemIds } },
      select: { id: true, title: true, url: true, status: true }
    }),
    deps.db.eventLog.findMany({
      where: {
        itemId: { in: dueItemIds },
        eventType: { in: ["MARK_RELEVANT", "MARK_NOT_RELEVANT", "DEFERRED_BUT_IMPORTANT"] }
      },
      select: { itemId: true, eventType: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const relevanceByItem = new Map<string, "MARK_RELEVANT" | "MARK_NOT_RELEVANT">();
  const deferredButImportantByItem = new Set<string>();
  for (const event of relevanceEvents) {
    if (event.eventType === "DEFERRED_BUT_IMPORTANT") {
      deferredButImportantByItem.add(event.itemId);
      continue;
    }

    if (!relevanceByItem.has(event.itemId)) {
      relevanceByItem.set(event.itemId, event.eventType as "MARK_RELEVANT" | "MARK_NOT_RELEVANT");
    }
  }

  const result = items.map((item) => ({
    itemId: item.id,
    title: item.title,
    url: item.url,
    status: item.status,
    dueAt: dueByItem.get(item.id)!.toISOString(),
    relevance: relevanceByItem.get(item.id) ?? null,
    deferredButImportant: deferredButImportantByItem.has(item.id)
  }));

  result.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return result;
}
