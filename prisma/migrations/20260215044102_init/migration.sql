-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL DEFAULT 'ENG',
    "timeBudgetMinutes" INTEGER,
    "hypeWords" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT,
    "normalizedUrl" TEXT,
    "title" TEXT,
    "author" TEXT,
    "publishedAt" DATETIME,
    "extractedText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Triage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "triageJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Triage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndexCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "triageId" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IndexCard_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IndexCard_triageId_fkey" FOREIGN KEY ("triageId") REFERENCES "Triage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "triageId" TEXT NOT NULL,
    "starLevel" INTEGER NOT NULL DEFAULT 3,
    "contentJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeCard_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeCard_triageId_fkey" FOREIGN KEY ("triageId") REFERENCES "Triage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngestionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureCode" TEXT,
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngestionAttempt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_normalizedUrl_key" ON "Item"("normalizedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Item_contentHash_key" ON "Item"("contentHash");

-- CreateIndex
CREATE INDEX "Item_normalizedUrl_idx" ON "Item"("normalizedUrl");

-- CreateIndex
CREATE INDEX "Item_contentHash_idx" ON "Item"("contentHash");

-- CreateIndex
CREATE INDEX "Triage_itemId_createdAt_idx" ON "Triage"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_itemId_eventType_createdAt_idx" ON "EventLog"("itemId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "IndexCard_itemId_createdAt_idx" ON "IndexCard"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "IndexCard_triageId_idx" ON "IndexCard"("triageId");

-- CreateIndex
CREATE INDEX "KnowledgeCard_itemId_createdAt_idx" ON "KnowledgeCard"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeCard_triageId_idx" ON "KnowledgeCard"("triageId");

-- CreateIndex
CREATE INDEX "IngestionAttempt_sourceType_status_createdAt_idx" ON "IngestionAttempt"("sourceType", "status", "createdAt");
