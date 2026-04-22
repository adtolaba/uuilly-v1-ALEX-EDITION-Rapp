/*
  Warnings:

  - Made the column `name` on table `ai_credentials` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ai_credentials" ALTER COLUMN "name" SET NOT NULL;
