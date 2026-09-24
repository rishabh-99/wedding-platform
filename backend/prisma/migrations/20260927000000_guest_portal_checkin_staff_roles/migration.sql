-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('TRAIN', 'FLIGHT', 'CAR', 'BUS', 'LOCAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TransportStatus" AS ENUM ('NOT_NEEDED', 'PENDING', 'ASSIGNED', 'DONE');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('NEEDS_CALL', 'CALLED', 'ON_THE_WAY', 'NOT_REACHABLE', 'NOT_COMING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'COORDINATOR';
ALTER TYPE "Role" ADD VALUE 'HOSPITALITY';
ALTER TYPE "Role" ADD VALUE 'PHOTOGRAPHER';

-- AlterEnum
ALTER TYPE "MediaPurpose" ADD VALUE 'PORTRAIT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "uploadedByRsvpId" TEXT;

-- AlterTable
ALTER TABLE "Rsvp" ADD COLUMN     "arrivalAt" TIMESTAMP(3),
ADD COLUMN     "arrivalDetails" TEXT,
ADD COLUMN     "arrivalMode" "TravelMode",
ADD COLUMN     "departureAt" TIMESTAMP(3),
ADD COLUMN     "departureDetails" TEXT,
ADD COLUMN     "departureMode" "TravelMode",
ADD COLUMN     "dropNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dropStatus" "TransportStatus" NOT NULL DEFAULT 'NOT_NEEDED',
ADD COLUMN     "pickupNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pickupStatus" "TransportStatus" NOT NULL DEFAULT 'NOT_NEEDED',
ADD COLUMN     "qrToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
ADD COLUMN     "transportNotes" TEXT;

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "checkedInByName" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL,
    "note" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestPortrait" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "takenByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestPortrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "rsvpId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyValue" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyValue_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "CheckIn_eventId_idx" ON "CheckIn"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_rsvpId_eventId_key" ON "CheckIn"("rsvpId", "eventId");

-- CreateIndex
CREATE INDEX "FollowUp_eventId_idx" ON "FollowUp"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_rsvpId_eventId_key" ON "FollowUp"("rsvpId", "eventId");

-- CreateIndex
CREATE INDEX "GuestPortrait_day_idx" ON "GuestPortrait"("day");

-- CreateIndex
CREATE UNIQUE INDEX "GuestPortrait_rsvpId_day_key" ON "GuestPortrait"("rsvpId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_qrToken_key" ON "Rsvp"("qrToken");

-- CreateIndex
CREATE INDEX "Rsvp_arrivalAt_idx" ON "Rsvp"("arrivalAt");

-- CreateIndex
CREATE INDEX "Rsvp_departureAt_idx" ON "Rsvp"("departureAt");

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "Rsvp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "Rsvp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPortrait" ADD CONSTRAINT "GuestPortrait_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "Rsvp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPortrait" ADD CONSTRAINT "GuestPortrait_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "Rsvp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
