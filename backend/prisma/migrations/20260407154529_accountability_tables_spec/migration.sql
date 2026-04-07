-- CreateEnum
CREATE TYPE "NudgeType" AS ENUM ('TEMPLATE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NudgeQuickReply" AS ENUM ('BUSY_OKAY', 'NEED_SUPPORT', 'CATCH_UP', 'LETS_CHAT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NUDGE_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'QUIET_MODE_NOTICE';

-- CreateTable
CREATE TABLE "nudges" (
    "id" TEXT NOT NULL,
    "pod_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "nudge_type" "NudgeType" NOT NULL,
    "message" TEXT,
    "template_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "response" "NudgeQuickReply",
    "responded_at" TIMESTAMP(3),
    "sentiment_score" DOUBLE PRECISION,
    "sentiment_label" "SentimentType",
    "flagged_for_review" BOOLEAN NOT NULL DEFAULT false,
    "sent_hour_utc" INTEGER,
    "sent_dow_utc" INTEGER,

    CONSTRAINT "nudges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiet_mode" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pod_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "reason" TEXT,
    "auto_notify" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiet_mode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountability_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pod_id" TEXT NOT NULL,
    "week_start_date" TIMESTAMP(3) NOT NULL,
    "nudges_received" INTEGER NOT NULL DEFAULT 0,
    "nudges_sent" INTEGER NOT NULL DEFAULT 0,
    "response_rate" DOUBLE PRECISION,

    CONSTRAINT "accountability_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nudges_pod_id_sent_at_idx" ON "nudges"("pod_id", "sent_at");

-- CreateIndex
CREATE INDEX "nudges_from_user_id_to_user_id_sent_at_idx" ON "nudges"("from_user_id", "to_user_id", "sent_at");

-- CreateIndex
CREATE INDEX "nudges_to_user_id_sent_at_idx" ON "nudges"("to_user_id", "sent_at");

-- CreateIndex
CREATE INDEX "nudges_from_user_id_sent_at_idx" ON "nudges"("from_user_id", "sent_at");

-- CreateIndex
CREATE INDEX "nudges_to_user_id_read_at_idx" ON "nudges"("to_user_id", "read_at");

-- Partial index: fast unread counts per recipient (read_at IS NULL)
CREATE INDEX "nudges_to_user_id_unread_idx" ON "nudges" ("to_user_id") WHERE "read_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "quiet_mode_user_id_pod_id_key" ON "quiet_mode"("user_id", "pod_id");

-- CreateIndex
CREATE INDEX "accountability_metrics_pod_id_week_start_date_idx" ON "accountability_metrics"("pod_id", "week_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "accountability_metrics_user_id_pod_id_week_start_date_key" ON "accountability_metrics"("user_id", "pod_id", "week_start_date");

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiet_mode" ADD CONSTRAINT "quiet_mode_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiet_mode" ADD CONSTRAINT "quiet_mode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_metrics" ADD CONSTRAINT "accountability_metrics_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_metrics" ADD CONSTRAINT "accountability_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
