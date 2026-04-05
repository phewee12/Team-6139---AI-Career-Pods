-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('PENDING', 'COMPLETED', 'LATE', 'SKIPPED');

-- AlterTable
ALTER TABLE "Pod" ADD COLUMN     "ritualDay" TEXT DEFAULT 'MONDAY',
ADD COLUMN     "ritualHour" INTEGER DEFAULT 9;

-- CreateTable
CREATE TABLE "PodCheckIn" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "status" "CheckInStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "goals" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodReflection" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodReflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodCelebration" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodCelebration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PodCheckIn_podId_weekStartDate_idx" ON "PodCheckIn"("podId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PodCheckIn_userId_idx" ON "PodCheckIn"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PodCheckIn_podId_userId_weekStartDate_key" ON "PodCheckIn"("podId", "userId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PodReflection_podId_weekStartDate_idx" ON "PodReflection"("podId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PodReflection_userId_idx" ON "PodReflection"("userId");

-- CreateIndex
CREATE INDEX "PodCelebration_podId_weekStartDate_idx" ON "PodCelebration"("podId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "PodCheckIn" ADD CONSTRAINT "PodCheckIn_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodCheckIn" ADD CONSTRAINT "PodCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodReflection" ADD CONSTRAINT "PodReflection_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodReflection" ADD CONSTRAINT "PodReflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodCelebration" ADD CONSTRAINT "PodCelebration_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodCelebration" ADD CONSTRAINT "PodCelebration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
