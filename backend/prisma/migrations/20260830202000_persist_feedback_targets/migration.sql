-- CreateEnum
CREATE TYPE "FeedbackEntityType" AS ENUM ('ATTRACTION', 'FACT', 'CROWD_RECORD');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('INACCURATE', 'OUTDATED', 'OTHER');

-- AlterTable
ALTER TABLE "feedback" ADD COLUMN "entity_type" "FeedbackEntityType" NOT NULL DEFAULT 'FACT';
ALTER TABLE "feedback" ADD COLUMN "entity_id" TEXT;
ALTER TABLE "feedback" ADD COLUMN "feedback_type" "FeedbackType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "feedback" ALTER COLUMN "fact_id" DROP NOT NULL;
UPDATE "feedback" SET "entity_id" = "fact_id" WHERE "entity_id" IS NULL;
ALTER TABLE "feedback" ALTER COLUMN "entity_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "feedback_entity_type_entity_id_idx" ON "feedback"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "feedback_feedback_type_idx" ON "feedback"("feedback_type");
