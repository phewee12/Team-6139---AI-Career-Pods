-- CreateTable
CREATE TABLE "Pod" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pod_slug_key" ON "Pod"("slug");

-- CreateIndex
CREATE INDEX "Pod_focusArea_idx" ON "Pod"("focusArea");

-- Seed starter pods
INSERT INTO "Pod" ("id", "slug", "name", "description", "focusArea", "isDefault", "updatedAt")
VALUES
  ('0e4f7425-63a8-4d71-9f7f-5b7577bbf901', 'internship-accelerator', 'Internship Accelerator', 'Weekly accountability pod focused on internship applications, referrals, and interview prep.', 'Internships', true, CURRENT_TIMESTAMP),
  ('5ad3006f-80d1-42f5-a8f3-4f1fd6db14bf', 'grad-school-strategy', 'Grad School Strategy', 'Collaborative pod for statement reviews, school selection, and graduate admissions timelines.', 'Graduate School', true, CURRENT_TIMESTAMP),
  ('d0c86f1f-c8a4-4e0d-88e3-2f16ff2d44a4', 'career-switch-lab', 'Career Switch Lab', 'Support pod for career switchers building portfolios, networking plans, and transition roadmaps.', 'Career Change', true, CURRENT_TIMESTAMP);
