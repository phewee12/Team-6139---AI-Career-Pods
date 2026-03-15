-- CreateEnum
CREATE TYPE "PodVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PodMembershipStatus" AS ENUM ('ACTIVE', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "PodMembershipRole" AS ENUM ('MEMBER', 'ADMIN');

-- AlterTable
ALTER TABLE "Pod"
ADD COLUMN "visibility" "PodVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "createdById" TEXT;

-- CreateTable
CREATE TABLE "PodMembership" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PodMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "PodMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "PodMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pod_visibility_idx" ON "Pod"("visibility");

-- CreateIndex
CREATE INDEX "Pod_createdById_idx" ON "Pod"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PodMembership_podId_userId_key" ON "PodMembership"("podId", "userId");

-- CreateIndex
CREATE INDEX "PodMembership_podId_status_idx" ON "PodMembership"("podId", "status");

-- CreateIndex
CREATE INDEX "PodMembership_userId_status_idx" ON "PodMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "PodMembership_reviewedById_idx" ON "PodMembership"("reviewedById");

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodMembership" ADD CONSTRAINT "PodMembership_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodMembership" ADD CONSTRAINT "PodMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodMembership" ADD CONSTRAINT "PodMembership_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
