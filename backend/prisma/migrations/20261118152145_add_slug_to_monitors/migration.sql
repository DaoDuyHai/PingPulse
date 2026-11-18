/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `monitors` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "monitors" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "monitors_slug_key" ON "monitors"("slug");
