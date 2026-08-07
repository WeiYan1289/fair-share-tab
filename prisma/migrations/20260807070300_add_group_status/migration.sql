-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('active', 'archived');

-- AlterTable
ALTER TABLE "group" ADD COLUMN     "status" "GroupStatus" NOT NULL DEFAULT 'active';
