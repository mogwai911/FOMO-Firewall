import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export async function resetAppData(): Promise<void> {
  await prisma.signalPreviewCache.deleteMany();
  await prisma.digestSnapshot.deleteMany();
  await prisma.digestRun.deleteMany();
  await prisma.eventLogV2.deleteMany();
  await prisma.appSettings.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.job.deleteMany();
  await prisma.sessionMessage.deleteMany();
  await prisma.insightCard.deleteMany();
  await prisma.evidencePack.deleteMany();
  await prisma.session.deleteMany();
  await prisma.signalDisposition.deleteMany();
  await prisma.signalTriage.deleteMany();
  await prisma.signal.deleteMany();
  await prisma.source.deleteMany();
}

export async function seedSignalForToday(input?: {
  sourceName?: string;
  signalTitle?: string;
  summary?: string;
  withTriage?: boolean;
  triageHeadline?: string;
}): Promise<{
  sourceId: string;
  sourceName: string;
  signalId: string;
  signalTitle: string;
}> {
  const suffix = uniqueSuffix();
  const sourceName = input?.sourceName ?? "Example Feed";
  const signalTitle = input?.signalTitle ?? "OpenAI update";
  const summary = input?.summary ?? "This is a seeded summary.";

  const source = await prisma.source.create({
    data: {
      rssUrl: `https://example.com/feed-${suffix}.xml`,
      name: sourceName,
      enabled: true,
      tagsJson: ["test"]
    }
  });

  const signal = await prisma.signal.create({
    data: {
      sourceId: source.id,
      title: signalTitle,
      url: `https://example.com/article-${suffix}`,
      guid: `guid-${suffix}`,
      publishedAt: new Date(),
      summary,
      rawEntryJson: {
        title: signalTitle
      }
    }
  });

  if (input?.withTriage !== false) {
    const triageHeadline = input?.triageHeadline ?? `AI总结：${signalTitle}`;
    await prisma.signalTriage.create({
      data: {
        signalId: signal.id,
        role: Role.ENG,
        triageJson: {
          label: "DO",
          headline: triageHeadline,
          reasons: [
            {
              type: "relevance",
              text: "该线索对当前工作有直接价值。",
              confidence: 0.82
            }
          ],
          snippets: [
            {
              text: summary,
              source: "rss_summary"
            }
          ],
          next_action_hint: "ENTER_SESSION",
          score: 82
        }
      }
    });
  }

  return {
    sourceId: source.id,
    sourceName,
    signalId: signal.id,
    signalTitle
  };
}

export async function seedSessionWithDisposition(signalId: string): Promise<{ sessionId: string }> {
  await prisma.signalDisposition.upsert({
    where: { signalId },
    create: {
      signalId,
      label: "DO",
      isOverride: true
    },
    update: {
      label: "DO",
      isOverride: true
    }
  });

  const session = await prisma.session.create({
    data: {
      signalId,
      status: "ACTIVE"
    }
  });

  return { sessionId: session.id };
}

export async function disconnectSeedClient(): Promise<void> {
  await prisma.$disconnect();
}
