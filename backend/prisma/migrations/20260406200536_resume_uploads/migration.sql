-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('MONDAY_SET', 'WEDNESDAY_CHECK', 'FRIDAY_REFLECT', 'WEEKEND_BREAK');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PHASE_REMINDER', 'CHECK_IN_REMINDER', 'REFLECTION_REMINDER', 'CELEBRATION_ALERT');

-- CreateEnum
CREATE TYPE "ResumeReviewStatus" AS ENUM ('OPEN', 'CLOSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ResumeRecommendation" AS ENUM ('STRONG_YES', 'YES_WITH_EDITS', 'NEEDS_MAJOR_REVISION');

-- CreateEnum
CREATE TYPE "SentimentType" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateTable
CREATE TABLE "PodPhase" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "currentPhase" "PhaseType" NOT NULL DEFAULT 'MONDAY_SET',
    "phaseStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextPhaseAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'PHASE_REMINDER',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReflectionSentiment" (
    "id" TEXT NOT NULL,
    "reflectionId" TEXT NOT NULL,
    "sentiment" "SentimentType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "keywords" TEXT[],
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReflectionSentiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodResumeReviewRequest" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "ResumeReviewStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "targetRole" TEXT,
    "context" TEXT,
    "dueAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodResumeReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodResumeFile" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodResumeFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodResumeReviewFeedback" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "overallScore" INTEGER,
    "impactAndResultsScore" INTEGER,
    "roleFitScore" INTEGER,
    "atsClarityScore" INTEGER,
    "strengths" TEXT NOT NULL,
    "improvements" TEXT NOT NULL,
    "lineLevelSuggestions" TEXT,
    "finalComments" TEXT,
    "recommendation" "ResumeRecommendation",
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodResumeReviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PodPhase_podId_key" ON "PodPhase"("podId");

-- CreateIndex
CREATE INDEX "PodPhase_podId_idx" ON "PodPhase"("podId");

-- CreateIndex
CREATE INDEX "PodPhase_currentPhase_idx" ON "PodPhase"("currentPhase");

-- CreateIndex
CREATE INDEX "Notification_userId_sentAt_idx" ON "Notification"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "Notification_podId_scheduledAt_idx" ON "Notification"("podId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_scheduledAt_idx" ON "Notification"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReflectionSentiment_reflectionId_key" ON "ReflectionSentiment"("reflectionId");

-- CreateIndex
CREATE INDEX "ReflectionSentiment_sentiment_idx" ON "ReflectionSentiment"("sentiment");

-- CreateIndex
CREATE INDEX "ReflectionSentiment_analyzedAt_idx" ON "ReflectionSentiment"("analyzedAt");

-- CreateIndex
CREATE INDEX "PodResumeReviewRequest_podId_status_createdAt_idx" ON "PodResumeReviewRequest"("podId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PodResumeReviewRequest_requesterId_createdAt_idx" ON "PodResumeReviewRequest"("requesterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PodResumeFile_requestId_key" ON "PodResumeFile"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "PodResumeFile_storagePath_key" ON "PodResumeFile"("storagePath");

-- CreateIndex
CREATE INDEX "PodResumeFile_uploadedById_uploadedAt_idx" ON "PodResumeFile"("uploadedById", "uploadedAt");

-- CreateIndex
CREATE INDEX "PodResumeReviewFeedback_reviewerId_submittedAt_idx" ON "PodResumeReviewFeedback"("reviewerId", "submittedAt");

-- CreateIndex
CREATE INDEX "PodResumeReviewFeedback_requestId_submittedAt_idx" ON "PodResumeReviewFeedback"("requestId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PodResumeReviewFeedback_requestId_reviewerId_key" ON "PodResumeReviewFeedback"("requestId", "reviewerId");

-- AddForeignKey
ALTER TABLE "PodPhase" ADD CONSTRAINT "PodPhase_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReflectionSentiment" ADD CONSTRAINT "ReflectionSentiment_reflectionId_fkey" FOREIGN KEY ("reflectionId") REFERENCES "PodReflection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodResumeReviewRequest" ADD CONSTRAINT "PodResumeReviewRequest_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodResumeReviewRequest" ADD CONSTRAINT "PodResumeReviewRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodResumeFile" ADD CONSTRAINT "PodResumeFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PodResumeReviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodResumeFile" ADD CONSTRAINT "PodResumeFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodResumeReviewFeedback" ADD CONSTRAINT "PodResumeReviewFeedback_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PodResumeReviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodResumeReviewFeedback" ADD CONSTRAINT "PodResumeReviewFeedback_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
