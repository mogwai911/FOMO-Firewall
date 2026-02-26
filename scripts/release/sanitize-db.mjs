#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SOURCES = [
  {
    rssUrl: "https://www.jiqizhixin.com/rss",
    name: "机器之心",
    tagsJson: ["ai", "china"]
  },
  {
    rssUrl: "https://www.qbitai.com/feed",
    name: "量子位",
    tagsJson: ["ai", "china"]
  }
];

async function main() {
  const existingSources = await prisma.source.findMany({
    select: {
      rssUrl: true
    }
  });
  const existingUrlSet = new Set(existingSources.map((source) => source.rssUrl));
  const missingDefaults = DEFAULT_SOURCES.filter((source) => !existingUrlSet.has(source.rssUrl));

  for (const source of missingDefaults) {
    await prisma.source.create({
      data: {
        rssUrl: source.rssUrl,
        name: source.name,
        tagsJson: source.tagsJson,
        enabled: true
      }
    });
  }

  await prisma.appSettings.upsert({
    where: {
      id: "default"
    },
    create: {
      id: "default",
      scheduleEnabled: false,
      scheduleTime: "09:00",
      timezone: "UTC",
      apiBaseUrl: "",
      apiKey: "",
      apiModel: "",
      triagePromptTemplate: "",
      sessionAssistantPromptTemplate: "",
      suggestedQuestionsPromptTemplate: ""
    },
    update: {
      apiBaseUrl: "",
      apiKey: "",
      apiModel: ""
    }
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        addedDefaultSources: missingDefaults.length,
        llmConfigCleared: true
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
