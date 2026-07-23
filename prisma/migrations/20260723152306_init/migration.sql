-- CreateEnum
CREATE TYPE "ShareLinkRole" AS ENUM ('editor', 'viewer');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "SplitMethod" AS ENUM ('equal', 'custom');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('unsettled', 'settled');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('draft', 'confirmed');

-- CreateTable
CREATE TABLE "group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_share_link" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "role" "ShareLinkRole" NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_share_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "avatar_color" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "status" "EventStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_member" (
    "event_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,

    CONSTRAINT "event_member_pkey" PRIMARY KEY ("event_id","member_id")
);

-- CreateTable
CREATE TABLE "bill" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "split_method" "SplitMethod" NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'unsettled',
    "category" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split" (
    "id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "share_amount" INTEGER NOT NULL,

    CONSTRAINT "split_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_bill" (
    "settlement_id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,

    CONSTRAINT "settlement_bill_pkey" PRIMARY KEY ("settlement_id","bill_id")
);

-- CreateTable
CREATE TABLE "transfer" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "from_member_id" UUID NOT NULL,
    "to_member_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_share_link_token_key" ON "group_share_link"("token");

-- CreateIndex
CREATE INDEX "member_group_id_idx" ON "member"("group_id");

-- CreateIndex
CREATE INDEX "member_group_id_is_active_idx" ON "member"("group_id", "is_active");

-- CreateIndex
CREATE INDEX "event_group_id_idx" ON "event"("group_id");

-- CreateIndex
CREATE INDEX "event_group_id_status_idx" ON "event"("group_id", "status");

-- CreateIndex
CREATE INDEX "event_member_member_id_idx" ON "event_member"("member_id");

-- CreateIndex
CREATE INDEX "bill_event_id_idx" ON "bill"("event_id");

-- CreateIndex
CREATE INDEX "bill_event_id_status_idx" ON "bill"("event_id", "status");

-- CreateIndex
CREATE INDEX "split_member_id_idx" ON "split"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "split_bill_id_member_id_key" ON "split"("bill_id", "member_id");

-- CreateIndex
CREATE INDEX "settlement_bill_bill_id_idx" ON "settlement_bill"("bill_id");

-- CreateIndex
CREATE INDEX "transfer_settlement_id_idx" ON "transfer"("settlement_id");

-- AddForeignKey
ALTER TABLE "group_share_link" ADD CONSTRAINT "group_share_link_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_member" ADD CONSTRAINT "event_member_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_member" ADD CONSTRAINT "event_member_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill" ADD CONSTRAINT "bill_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill" ADD CONSTRAINT "bill_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split" ADD CONSTRAINT "split_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split" ADD CONSTRAINT "split_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_bill" ADD CONSTRAINT "settlement_bill_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_bill" ADD CONSTRAINT "settlement_bill_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
