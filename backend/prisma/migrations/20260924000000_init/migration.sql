-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiveModeSetting" AS ENUM ('AUTO', 'ON', 'OFF');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('GALLERY', 'LIVE', 'GUESTBOOK', 'BRANDING', 'DRESSCODE', 'STORY');

-- CreateEnum
CREATE TYPE "LiveUpdateType" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ATTENDING', 'MAYBE', 'DECLINED');

-- CreateEnum
CREATE TYPE "DietaryPreference" AS ENUM ('VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'JAIN', 'NO_PREFERENCE');

-- CreateEnum
CREATE TYPE "GuestbookStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "coupleName1" TEXT NOT NULL,
    "coupleName2" TEXT NOT NULL,
    "familiesLine" TEXT NOT NULL DEFAULT 'Together with their families',
    "inviteLine" TEXT NOT NULL DEFAULT 'invite you to celebrate their wedding',
    "welcomeMessage" TEXT NOT NULL DEFAULT '',
    "weddingDatesLabel" TEXT NOT NULL,
    "weddingHashtag" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "contactPhone" TEXT,
    "contactWhatsapp" TEXT,
    "contactEmail" TEXT,
    "siteTitle" TEXT NOT NULL,
    "siteDescription" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "theme" JSONB,
    "liveMode" "LiveModeSetting" NOT NULL DEFAULT 'AUTO',
    "liveBannerText" TEXT NOT NULL DEFAULT 'The celebrations have begun',
    "archiveHeadline" TEXT NOT NULL DEFAULT 'The celebrations have come to a close.',
    "archiveSubheadline" TEXT NOT NULL DEFAULT 'But the memories remain.',
    "logoAssetId" TEXT,
    "ogImageAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "mapsUrl" TEXT,
    "description" TEXT,
    "parkingInformation" TEXT,
    "nearbyLandmarks" TEXT,
    "transportInformation" TEXT,
    "contactInformation" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3),
    "venueId" TEXT,
    "dressCode" TEXT,
    "dressCodeDescription" TEXT,
    "dressPalette" JSONB,
    "helpfulInfo" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "eventId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL DEFAULT 'local',
    "variants" JSONB,
    "placeholder" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "type" "MediaType" NOT NULL,
    "purpose" "MediaPurpose" NOT NULL DEFAULT 'GALLERY',
    "eventId" TEXT,
    "albumId" TEXT,
    "caption" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveUpdate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "type" "LiveUpdateType" NOT NULL DEFAULT 'TEXT',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rsvp" (
    "id" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "email" TEXT,
    "numberOfGuests" INTEGER NOT NULL DEFAULT 1,
    "attendanceStatus" "AttendanceStatus" NOT NULL,
    "dietaryPreference" "DietaryPreference" NOT NULL DEFAULT 'NO_PREFERENCE',
    "message" TEXT,
    "idempotencyKey" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RsvpEvent" (
    "rsvpId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "RsvpEvent_pkey" PRIMARY KEY ("rsvpId","eventId")
);

-- CreateTable
CREATE TABLE "GuestbookMessage" (
    "id" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "status" "GuestbookStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestbookMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorySection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorySection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelSection" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "links" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_isPublished_startDateTime_idx" ON "Event"("isPublished", "startDateTime");

-- CreateIndex
CREATE INDEX "Event_displayOrder_idx" ON "Event"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Album_slug_key" ON "Album"("slug");

-- CreateIndex
CREATE INDEX "Album_displayOrder_idx" ON "Album"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_purpose_isPublished_createdAt_idx" ON "MediaAsset"("purpose", "isPublished", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_albumId_displayOrder_idx" ON "MediaAsset"("albumId", "displayOrder");

-- CreateIndex
CREATE INDEX "MediaAsset_eventId_idx" ON "MediaAsset"("eventId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_idx" ON "MediaAsset"("type");

-- CreateIndex
CREATE INDEX "LiveUpdate_published_publishedAt_idx" ON "LiveUpdate"("published", "publishedAt");

-- CreateIndex
CREATE INDEX "LiveUpdate_scheduledFor_idx" ON "LiveUpdate"("scheduledFor");

-- CreateIndex
CREATE INDEX "LiveUpdate_eventId_idx" ON "LiveUpdate"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_phoneNormalized_key" ON "Rsvp"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_idempotencyKey_key" ON "Rsvp"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Rsvp_attendanceStatus_idx" ON "Rsvp"("attendanceStatus");

-- CreateIndex
CREATE INDEX "Rsvp_submittedAt_idx" ON "Rsvp"("submittedAt");

-- CreateIndex
CREATE INDEX "Rsvp_guestName_idx" ON "Rsvp"("guestName");

-- CreateIndex
CREATE INDEX "Rsvp_email_idx" ON "Rsvp"("email");

-- CreateIndex
CREATE INDEX "RsvpEvent_eventId_idx" ON "RsvpEvent"("eventId");

-- CreateIndex
CREATE INDEX "GuestbookMessage_status_createdAt_idx" ON "GuestbookMessage"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StorySection_key_key" ON "StorySection"("key");

-- CreateIndex
CREATE INDEX "TravelSection_displayOrder_idx" ON "TravelSection"("displayOrder");

-- CreateIndex
CREATE INDEX "FaqItem_displayOrder_idx" ON "FaqItem"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Backup_storageKey_key" ON "Backup"("storageKey");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingSettings" ADD CONSTRAINT "WeddingSettings_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingSettings" ADD CONSTRAINT "WeddingSettings_ogImageAssetId_fkey" FOREIGN KEY ("ogImageAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveUpdate" ADD CONSTRAINT "LiveUpdate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveUpdate" ADD CONSTRAINT "LiveUpdate_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpEvent" ADD CONSTRAINT "RsvpEvent_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "Rsvp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpEvent" ADD CONSTRAINT "RsvpEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestbookMessage" ADD CONSTRAINT "GuestbookMessage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySection" ADD CONSTRAINT "StorySection_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
