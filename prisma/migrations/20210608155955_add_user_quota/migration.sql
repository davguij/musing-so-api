/*
  Warnings:

  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "isActive",
ADD COLUMN     "remainingQuota" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "quotaRefreshDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
