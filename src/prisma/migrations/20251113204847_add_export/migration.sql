-- CreateTable
CREATE TABLE "ExportJob" (
    "id" SERIAL NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'ndjson',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "filePath" TEXT,
    "downloadUrl" TEXT,
    "filters" JSONB,
    "fields" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExportJob_idempotencyKey_key" ON "ExportJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExportJob_idempotencyKey_idx" ON "ExportJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");

-- CreateIndex
CREATE INDEX "ExportJob_createdAt_idx" ON "ExportJob"("createdAt");
