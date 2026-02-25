-- CreateTable
CREATE TABLE "EventLogV2" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "signalId" TEXT,
    "sessionId" TEXT,
    "jobId" TEXT,
    "payloadJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLogV2_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLogV2_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLogV2_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EventLogV2_type_createdAt_idx" ON "EventLogV2"("type", "createdAt");

-- CreateIndex
CREATE INDEX "EventLogV2_signalId_createdAt_idx" ON "EventLogV2"("signalId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLogV2_sessionId_createdAt_idx" ON "EventLogV2"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLogV2_jobId_createdAt_idx" ON "EventLogV2"("jobId", "createdAt");
