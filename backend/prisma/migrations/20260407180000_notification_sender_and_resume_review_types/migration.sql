-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MEMBER_JOINED';
ALTER TYPE "NotificationType" ADD VALUE 'RESUME_REVIEW_RECEIVED';

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "senderId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_senderId_sentAt_idx" ON "Notification"("senderId", "sentAt");

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
