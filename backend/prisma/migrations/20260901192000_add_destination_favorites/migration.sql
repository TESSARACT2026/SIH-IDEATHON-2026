ALTER TABLE "favorites" ADD COLUMN "destination_id" TEXT;
ALTER TABLE "favorites" ALTER COLUMN "attraction_id" DROP NOT NULL;

CREATE UNIQUE INDEX "favorites_user_id_destination_id_key" ON "favorites"("user_id", "destination_id");
CREATE INDEX "favorites_destination_id_idx" ON "favorites"("destination_id");

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_destination_id_fkey"
  FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_one_target_check"
  CHECK (
    ("attraction_id" IS NOT NULL AND "destination_id" IS NULL)
    OR
    ("attraction_id" IS NULL AND "destination_id" IS NOT NULL)
  );
