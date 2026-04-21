CREATE TABLE "EngagementMetrics" (
                                     "id" TEXT NOT NULL,
                                     "userId" TEXT NOT NULL,
                                     "podId" TEXT NOT NULL,
                                     "weekStartDate" TIMESTAMP(3) NOT NULL,
                                     "messagesCount" INTEGER NOT NULL DEFAULT 0,
                                     "goalsCompleted" INTEGER NOT NULL DEFAULT 0,
                                     "applicationsSubmitted" INTEGER NOT NULL DEFAULT 0,
                                     "checkinsCompleted" INTEGER NOT NULL DEFAULT 0,
                                     "reflectionsCompleted" INTEGER NOT NULL DEFAULT 0,
                                     "celebrationsCreated" INTEGER NOT NULL DEFAULT 0,
                                     "resumeReviewsGiven" INTEGER NOT NULL DEFAULT 0,
                                     "nudgesSent" INTEGER NOT NULL DEFAULT 0,
                                     "nudgesReplied" INTEGER NOT NULL DEFAULT 0,
                                     "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                     "updatedAt" TIMESTAMP(3) NOT NULL,

                                     CONSTRAINT "EngagementMetrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EngagementScores" (
                                    "id" TEXT NOT NULL,
                                    "userId" TEXT NOT NULL,
                                    "podId" TEXT NOT NULL,
                                    "weekStartDate" TIMESTAMP(3) NOT NULL,
                                    "score" INTEGER NOT NULL,
                                    "level" TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
                                    "previousScore" INTEGER,
                                    "trend" TEXT, -- 'UP', 'DOWN', 'STABLE'
                                    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                    CONSTRAINT "EngagementScores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EngagementMetrics_userId_podId_weekStartDate_idx"
    ON "EngagementMetrics"("userId", "podId", "weekStartDate");

CREATE INDEX "EngagementScores_userId_podId_calculatedAt_idx"
    ON "EngagementScores"("userId", "podId", "calculatedAt");

CREATE UNIQUE INDEX "EngagementMetrics_userId_podId_weekStartDate_key"
    ON "EngagementMetrics"("userId", "podId", "weekStartDate");

CREATE UNIQUE INDEX "EngagementScores_userId_podId_weekStartDate_key"
    ON "EngagementScores"("userId", "podId", "weekStartDate");

ALTER TABLE "EngagementMetrics"
    ADD CONSTRAINT "EngagementMetrics_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "EngagementMetrics"
    ADD CONSTRAINT "EngagementMetrics_podId_fkey"
        FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE;

ALTER TABLE "EngagementScores"
    ADD CONSTRAINT "EngagementScores_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "EngagementScores"
    ADD CONSTRAINT "EngagementScores_podId_fkey"
        FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE;