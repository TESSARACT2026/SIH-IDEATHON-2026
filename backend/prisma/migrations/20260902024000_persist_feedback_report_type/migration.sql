-- CreateEnum
CREATE TYPE "FeedbackReportType" AS ENUM (
  'CLOSED',
  'PRICE_CHANGED',
  'ACCESSIBILITY_INCORRECT',
  'HOURS_INCORRECT',
  'ROAD_BLOCKED',
  'OVERCROWDED',
  'FACILITY_UNAVAILABLE',
  'OTHER'
);

-- AlterTable
ALTER TABLE "feedback" ADD COLUMN "report_type" "FeedbackReportType";
