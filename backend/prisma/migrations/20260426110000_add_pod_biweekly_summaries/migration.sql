-- CreateTable
CREATE TABLE "PodBiweeklySummary" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "windowStartAt" TIMESTAMP(3) NOT NULL,
    "windowEndAt" TIMESTAMP(3) NOT NULL,
    "summaryText" TEXT NOT NULL,
    "sourceCounts" JSONB,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodBiweeklySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PodBiweeklySummary_podId_windowStartAt_key" ON "PodBiweeklySummary"("podId", "windowStartAt");

-- CreateIndex
CREATE INDEX "PodBiweeklySummary_podId_windowStartAt_idx" ON "PodBiweeklySummary"("podId", "windowStartAt");

-- CreateIndex
CREATE INDEX "PodBiweeklySummary_generatedById_idx" ON "PodBiweeklySummary"("generatedById");

-- AddForeignKey
ALTER TABLE "PodBiweeklySummary" ADD CONSTRAINT "PodBiweeklySummary_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodBiweeklySummary" ADD CONSTRAINT "PodBiweeklySummary_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
