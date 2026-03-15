-- CreateTable
CREATE TABLE "PodPost" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PodPost_podId_createdAt_idx" ON "PodPost"("podId", "createdAt");

-- CreateIndex
CREATE INDEX "PodPost_authorId_idx" ON "PodPost"("authorId");

-- AddForeignKey
ALTER TABLE "PodPost" ADD CONSTRAINT "PodPost_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodPost" ADD CONSTRAINT "PodPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
