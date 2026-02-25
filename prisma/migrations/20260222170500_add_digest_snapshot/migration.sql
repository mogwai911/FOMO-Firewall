-- CreateTable
CREATE TABLE "DigestSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateKey" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "signalIdsJson" JSONB NOT NULL,
    "refreshMetaJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DigestSnapshot_dateKey_windowDays_key" ON "DigestSnapshot"("dateKey", "windowDays");

-- CreateIndex
CREATE INDEX "DigestSnapshot_updatedAt_idx" ON "DigestSnapshot"("updatedAt");
