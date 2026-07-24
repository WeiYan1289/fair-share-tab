-- DropForeignKey
ALTER TABLE "settlement" DROP CONSTRAINT "settlement_group_id_fkey";

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'MYR';

-- AlterTable
ALTER TABLE "group" DROP COLUMN "currency";

-- AlterTable
ALTER TABLE "settlement" DROP COLUMN "group_id",
ADD COLUMN     "event_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
