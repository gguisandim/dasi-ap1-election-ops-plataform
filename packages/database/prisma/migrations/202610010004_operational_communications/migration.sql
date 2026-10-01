-- CreateEnum
CREATE TYPE "CommunicationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationAudienceType" AS ENUM ('ALL', 'ELECTORAL_ZONE', 'POLLING_PLACE', 'FIELD_TEAM', 'OPERATIONAL_ROLE', 'USER');

-- CreateEnum
CREATE TYPE "CommunicationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'VIEWED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "CommunicationEventType" AS ENUM ('CREATED', 'UPDATED', 'SCHEDULED', 'PUBLISHED', 'DISPATCHED', 'RECIPIENTS_SYNCED', 'VIEWED', 'CONFIRMED', 'EXPIRED', 'ARCHIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CommunicationCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTag" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTagLink" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CommunicationTagLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultTitle" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "CommunicationPriority" NOT NULL DEFAULT 'NORMAL',
    "categoryId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "CommunicationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFT',
    "electionId" TEXT NOT NULL,
    "categoryId" TEXT,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "observations" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAudience" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "type" "CommunicationAudienceType" NOT NULL,
    "electoralZoneId" TEXT,
    "pollingPlaceId" TEXT,
    "fieldTeamId" TEXT,
    "fieldRoleId" TEXT,
    "userId" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationRecipient" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "audienceId" TEXT,
    "userId" TEXT,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "roleLabel" TEXT,
    "sourceLabel" TEXT,
    "deliveryStatus" "CommunicationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmationNote" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationEvent" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "type" "CommunicationEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationCategory_key_key" ON "CommunicationCategory"("key");

-- CreateIndex
CREATE INDEX "CommunicationCategory_active_name_idx" ON "CommunicationCategory"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTag_label_key" ON "CommunicationTag"("label");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTag_slug_key" ON "CommunicationTag"("slug");

-- CreateIndex
CREATE INDEX "CommunicationTag_label_idx" ON "CommunicationTag"("label");

-- CreateIndex
CREATE INDEX "CommunicationTagLink_tagId_idx" ON "CommunicationTagLink"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTagLink_communicationId_tagId_key" ON "CommunicationTagLink"("communicationId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_name_key" ON "CommunicationTemplate"("name");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_active_name_idx" ON "CommunicationTemplate"("active", "name");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_categoryId_idx" ON "CommunicationTemplate"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Communication_code_key" ON "Communication"("code");

-- CreateIndex
CREATE INDEX "Communication_electionId_status_idx" ON "Communication"("electionId", "status");

-- CreateIndex
CREATE INDEX "Communication_status_priority_idx" ON "Communication"("status", "priority");

-- CreateIndex
CREATE INDEX "Communication_priority_publishedAt_idx" ON "Communication"("priority", "publishedAt");

-- CreateIndex
CREATE INDEX "Communication_categoryId_idx" ON "Communication"("categoryId");

-- CreateIndex
CREATE INDEX "Communication_publishedAt_idx" ON "Communication"("publishedAt");

-- CreateIndex
CREATE INDEX "Communication_expiresAt_idx" ON "Communication"("expiresAt");

-- CreateIndex
CREATE INDEX "CommunicationAudience_communicationId_type_idx" ON "CommunicationAudience"("communicationId", "type");

-- CreateIndex
CREATE INDEX "CommunicationAudience_electoralZoneId_idx" ON "CommunicationAudience"("electoralZoneId");

-- CreateIndex
CREATE INDEX "CommunicationAudience_pollingPlaceId_idx" ON "CommunicationAudience"("pollingPlaceId");

-- CreateIndex
CREATE INDEX "CommunicationAudience_fieldTeamId_idx" ON "CommunicationAudience"("fieldTeamId");

-- CreateIndex
CREATE INDEX "CommunicationAudience_fieldRoleId_idx" ON "CommunicationAudience"("fieldRoleId");

-- CreateIndex
CREATE INDEX "CommunicationAudience_userId_idx" ON "CommunicationAudience"("userId");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_communicationId_deliveryStatus_idx" ON "CommunicationRecipient"("communicationId", "deliveryStatus");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_userId_deliveryStatus_idx" ON "CommunicationRecipient"("userId", "deliveryStatus");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_memberId_idx" ON "CommunicationRecipient"("memberId");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_audienceId_idx" ON "CommunicationRecipient"("audienceId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationRecipient_communicationId_dedupeKey_key" ON "CommunicationRecipient"("communicationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "CommunicationEvent_communicationId_createdAt_idx" ON "CommunicationEvent"("communicationId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationEvent_type_createdAt_idx" ON "CommunicationEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunicationTagLink" ADD CONSTRAINT "CommunicationTagLink_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTagLink" ADD CONSTRAINT "CommunicationTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CommunicationTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CommunicationCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CommunicationCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAudience" ADD CONSTRAINT "CommunicationAudience_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAudience" ADD CONSTRAINT "CommunicationAudience_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAudience" ADD CONSTRAINT "CommunicationAudience_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAudience" ADD CONSTRAINT "CommunicationAudience_fieldTeamId_fkey" FOREIGN KEY ("fieldTeamId") REFERENCES "FieldTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAudience" ADD CONSTRAINT "CommunicationAudience_fieldRoleId_fkey" FOREIGN KEY ("fieldRoleId") REFERENCES "FieldRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAudience" ADD CONSTRAINT "CommunicationAudience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "CommunicationAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FieldMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

