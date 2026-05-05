-- Add user profile fields used by discovery recommendations.
ALTER TABLE "User"
ADD COLUMN "locationCity" TEXT,
ADD COLUMN "preferredGroupSize" TEXT;

-- Add optional pod location used by discovery recommendations.
ALTER TABLE "Pod"
ADD COLUMN "locationCity" TEXT;

CREATE INDEX "User_locationCity_idx" ON "User"("locationCity");
CREATE INDEX "User_preferredGroupSize_idx" ON "User"("preferredGroupSize");
CREATE INDEX "Pod_locationCity_idx" ON "Pod"("locationCity");