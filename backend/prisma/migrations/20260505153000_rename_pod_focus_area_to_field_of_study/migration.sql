-- Rename pod focus area to optional field of study.
ALTER TABLE "Pod" RENAME COLUMN "focusArea" TO "fieldOfStudy";
ALTER TABLE "Pod" ALTER COLUMN "fieldOfStudy" DROP NOT NULL;

DROP INDEX IF EXISTS "Pod_focusArea_idx";
CREATE INDEX IF NOT EXISTS "Pod_fieldOfStudy_idx" ON "Pod"("fieldOfStudy");
