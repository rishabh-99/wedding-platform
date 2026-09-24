-- AlterTable
ALTER TABLE "WeddingSettings" ADD COLUMN     "whatsappGroupUrl" TEXT;

-- AlterTable
ALTER TABLE "Rsvp" DROP COLUMN "dietaryPreference";

-- DropEnum
DROP TYPE "DietaryPreference";
