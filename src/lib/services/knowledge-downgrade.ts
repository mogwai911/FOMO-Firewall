import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { EventType } from "@/lib/domain/enums";

export interface StaleKnowledgeCard {
  id: string;
  itemId: string;
  triageId: string;
  createdAt: Date;
  contentJson: unknown;
  item: {
    title: string | null;
    url: string | null;
  };
}

interface KnowledgeDowngradeDeps {
  listStaleKnowledgeCards: (staleBefore: Date) => Promise<StaleKnowledgeCard[]>;
  hasRecentActivity: (itemId: string, since: Date) => Promise<boolean>;
  createIndexCardFromKnowledge: (card: StaleKnowledgeCard, now: Date) => Promise<void>;
  deleteKnowledgeCard: (knowledgeCardId: string) => Promise<void>;
}

export interface KnowledgeDowngradeSummary {
  scanned: number;
  downgraded: number;
  skipped: number;
  staleBefore: string;
}

function staleBeforeDate(now: Date, staleDays: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - staleDays);
  return cutoff;
}

export async function downgradeStaleKnowledgeCards(
  deps: KnowledgeDowngradeDeps,
  options: {
    now?: Date;
    staleDays?: number;
  } = {}
): Promise<KnowledgeDowngradeSummary> {
  const now = options.now ?? new Date();
  const staleDays = options.staleDays ?? 21;
  const staleBefore = staleBeforeDate(now, staleDays);

  const staleCards = await deps.listStaleKnowledgeCards(staleBefore);
  let downgraded = 0;
  let skipped = 0;

  for (const card of staleCards) {
    const hasRecentActivity = await deps.hasRecentActivity(card.itemId, card.createdAt);
    if (hasRecentActivity) {
      skipped += 1;
      continue;
    }

    await deps.createIndexCardFromKnowledge(card, now);
    await deps.deleteKnowledgeCard(card.id);
    downgraded += 1;
  }

  return {
    scanned: staleCards.length,
    downgraded,
    skipped,
    staleBefore: staleBefore.toISOString()
  };
}

const defaultDeps: KnowledgeDowngradeDeps = {
  listStaleKnowledgeCards: (staleBefore) =>
    db.knowledgeCard.findMany({
      where: {
        createdAt: {
          lte: staleBefore
        }
      },
      select: {
        id: true,
        itemId: true,
        triageId: true,
        createdAt: true,
        contentJson: true,
        item: {
          select: {
            title: true,
            url: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    }) as Promise<StaleKnowledgeCard[]>,
  hasRecentActivity: async (itemId, since) => {
    const event = await db.eventLog.findFirst({
      where: {
        itemId,
        eventType: {
          in: [EventType.CARD_REVISITED, EventType.CARD_REFERENCED]
        },
        createdAt: {
          gte: since
        }
      },
      select: {
        id: true
      }
    });

    return Boolean(event);
  },
  createIndexCardFromKnowledge: async (card, now) => {
    await db.indexCard.create({
      data: {
        itemId: card.itemId,
        triageId: card.triageId,
        contentJson: {
          title: card.item.title ?? "Untitled",
          url: card.item.url ?? "",
          one_line_takeaway: "Auto-downgraded from stale knowledge card",
          why_it_felt_urgent: "",
          why_defer_or_ignore:
            "Knowledge card became stale (>21 days) without revisit/reference signals.",
          review_trigger: "WHEN_RELEVANCE_RETURNS",
          trace: {
            item_id: card.itemId,
            triage_id: card.triageId,
            downgraded_from_knowledge_card_id: card.id,
            downgraded_at: now.toISOString()
          },
          knowledge_snapshot: card.contentJson
        } as Prisma.InputJsonValue
      }
    });
  },
  deleteKnowledgeCard: async (knowledgeCardId) => {
    await db.knowledgeCard.delete({
      where: {
        id: knowledgeCardId
      }
    });
  }
};

export async function runKnowledgeCardDowngrade(options: {
  staleDays?: number;
  now?: Date;
} = {}): Promise<KnowledgeDowngradeSummary> {
  return downgradeStaleKnowledgeCards(defaultDeps, options);
}
