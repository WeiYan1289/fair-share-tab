-- Add group_id nullable first so existing rows can be backfilled.
ALTER TABLE "settlement" ADD COLUMN "group_id" UUID;

-- Backfill from each settlement's event (every existing row is event-scoped).
UPDATE "settlement" s
SET "group_id" = e."group_id"
FROM "event" e
WHERE s."event_id" = e."id";

-- Now enforce non-null.
ALTER TABLE "settlement" ALTER COLUMN "group_id" SET NOT NULL;

-- Relax event_id: cross-event settlements leave it null.
ALTER TABLE "settlement" ALTER COLUMN "event_id" DROP NOT NULL;

-- FK + index for group_id.
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "settlement_group_id_idx" ON "settlement"("group_id");
