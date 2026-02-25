import { db } from "@/lib/db";

export interface LibraryQueryParams {
  type: "all" | "knowledge" | "index";
  keyword?: string;
  role?: "PM" | "ENG" | "RES";
  dateFrom?: string;
  dateTo?: string;
}

type FeedbackEventType = "MARK_RELEVANT" | "MARK_NOT_RELEVANT";

interface RankableCard {
  id: string;
  itemId: string;
  createdAt: Date;
}

function buildDateWhere(params: LibraryQueryParams): { gte?: Date; lte?: Date } | undefined {
  const gte = params.dateFrom ? new Date(params.dateFrom) : undefined;
  const lte = params.dateTo ? new Date(params.dateTo) : undefined;
  const hasGte = gte && !Number.isNaN(gte.getTime());
  const hasLte = lte && !Number.isNaN(lte.getTime());

  if (!hasGte && !hasLte) {
    return undefined;
  }

  return {
    gte: hasGte ? gte : undefined,
    lte: hasLte ? lte : undefined
  };
}

function buildCardWhere(params: LibraryQueryParams): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const dateWhere = buildDateWhere(params);
  if (dateWhere) {
    where.createdAt = dateWhere;
  }

  if (params.role) {
    where.triage = { role: params.role };
  }

  if (params.keyword) {
    where.OR = [
      { item: { title: { contains: params.keyword, mode: "insensitive" } } },
      { item: { url: { contains: params.keyword, mode: "insensitive" } } }
    ];
  }

  return where;
}

function buildFeedbackWeightByItem(
  events: Array<{ itemId: string; eventType: FeedbackEventType; createdAt: Date }>
): Map<string, number> {
  const weightByItem = new Map<string, number>();

  for (const event of events) {
    if (weightByItem.has(event.itemId)) {
      continue;
    }

    weightByItem.set(event.itemId, event.eventType === "MARK_RELEVANT" ? 1 : -1);
  }

  return weightByItem;
}

function rankCardsByFeedback<T extends RankableCard>(cards: T[], feedbackWeightByItem: Map<string, number>): T[] {
  return [...cards].sort((a, b) => {
    const weightA = feedbackWeightByItem.get(a.itemId) ?? 0;
    const weightB = feedbackWeightByItem.get(b.itemId) ?? 0;

    if (weightA !== weightB) {
      return weightB - weightA;
    }

    const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return a.id.localeCompare(b.id);
  });
}

export async function queryLibrary(
  params: LibraryQueryParams,
  deps: { db: typeof db } = { db }
): Promise<{
  knowledgeCards: unknown[];
  indexCards: unknown[];
}> {
  const where = buildCardWhere(params);

  const [knowledgeCardsRaw, indexCardsRaw] = await Promise.all([
    params.type === "index"
      ? Promise.resolve([])
      : deps.db.knowledgeCard.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { item: true, triage: true }
        }),
    params.type === "knowledge"
      ? Promise.resolve([])
      : deps.db.indexCard.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { item: true, triage: true }
        })
  ]);

  const knowledgeCards = knowledgeCardsRaw as RankableCard[];
  const indexCards = indexCardsRaw as RankableCard[];
  const itemIds = [...new Set([...knowledgeCards, ...indexCards].map((card) => card.itemId))];

  if (itemIds.length === 0) {
    return { knowledgeCards, indexCards };
  }

  const feedbackEvents = await deps.db.eventLog.findMany({
    where: {
      itemId: { in: itemIds },
      eventType: { in: ["MARK_RELEVANT", "MARK_NOT_RELEVANT"] }
    },
    select: {
      itemId: true,
      eventType: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const feedbackWeightByItem = buildFeedbackWeightByItem(
    feedbackEvents as Array<{ itemId: string; eventType: FeedbackEventType; createdAt: Date }>
  );

  return {
    knowledgeCards: rankCardsByFeedback(knowledgeCards, feedbackWeightByItem),
    indexCards: rankCardsByFeedback(indexCards, feedbackWeightByItem)
  };
}
