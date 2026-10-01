-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('PHOTO', 'DOCUMENT', 'RECEIPT', 'REPORT', 'LOG', 'SCREENSHOT', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvidenceLinkType" AS ENUM ('INCIDENT', 'ASSET', 'POLLING_PLACE', 'ELECTORAL_ZONE', 'ROUTE', 'DELIVERY', 'TRANSMISSION', 'RISK', 'COMMUNICATION', 'FIELD_TEAM', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceEventType" AS ENUM ('CREATED', 'UPLOADED', 'VERSION_ADDED', 'METADATA_UPDATED', 'LINK_ADDED', 'LINK_REMOVED', 'ARCHIVED', 'RESTORED', 'DOWNLOADED');

-- CreateTable
CREATE TABLE "EvidenceTag" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceTagLink" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "EvidenceTagLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EvidenceType" NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "electionId" TEXT,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "origin" TEXT,
    "observations" TEXT,
    "capturedAt" TIMESTAMP(3),
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "versionCount" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceVersion" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "type" "EvidenceLinkType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceEvent" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "type" "EvidenceEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceTag_label_key" ON "EvidenceTag"("label");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceTag_slug_key" ON "EvidenceTag"("slug");

-- CreateIndex
CREATE INDEX "EvidenceTag_label_idx" ON "EvidenceTag"("label");

-- CreateIndex
CREATE INDEX "EvidenceTagLink_tagId_idx" ON "EvidenceTagLink"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceTagLink_evidenceId_tagId_key" ON "EvidenceTagLink"("evidenceId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_code_key" ON "Evidence"("code");

-- CreateIndex
CREATE INDEX "Evidence_type_status_idx" ON "Evidence"("type", "status");

-- CreateIndex
CREATE INDEX "Evidence_electionId_status_idx" ON "Evidence"("electionId", "status");

-- CreateIndex
CREATE INDEX "Evidence_authorId_idx" ON "Evidence"("authorId");

-- CreateIndex
CREATE INDEX "Evidence_createdAt_idx" ON "Evidence"("createdAt");

-- CreateIndex
CREATE INDEX "Evidence_capturedAt_idx" ON "Evidence"("capturedAt");

-- CreateIndex
CREATE INDEX "EvidenceVersion_evidenceId_createdAt_idx" ON "EvidenceVersion"("evidenceId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceVersion_checksum_idx" ON "EvidenceVersion"("checksum");

-- CreateIndex
CREATE INDEX "EvidenceVersion_isCurrent_idx" ON "EvidenceVersion"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceVersion_evidenceId_number_key" ON "EvidenceVersion"("evidenceId", "number");

-- CreateIndex
CREATE INDEX "EvidenceLink_type_targetId_idx" ON "EvidenceLink"("type", "targetId");

-- CreateIndex
CREATE INDEX "EvidenceLink_evidenceId_idx" ON "EvidenceLink"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceLink_evidenceId_type_targetId_key" ON "EvidenceLink"("evidenceId", "type", "targetId");

-- CreateIndex
CREATE INDEX "EvidenceEvent_evidenceId_createdAt_idx" ON "EvidenceEvent"("evidenceId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceEvent_type_createdAt_idx" ON "EvidenceEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "EvidenceTagLink" ADD CONSTRAINT "EvidenceTagLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceTagLink" ADD CONSTRAINT "EvidenceTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "EvidenceTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceEvent" ADD CONSTRAINT "EvidenceEvent_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

