CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ALLOCATED', 'IN_TRANSIT', 'IN_USE', 'MAINTENANCE', 'LOST', 'RETIRED');
CREATE TYPE "AssetCondition" AS ENUM ('GOOD', 'ATTENTION', 'DAMAGED', 'UNAVAILABLE');

CREATE TABLE "AssetType" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AssetType_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Asset" (
  "id" TEXT NOT NULL, "assetTag" TEXT NOT NULL, "name" TEXT NOT NULL, "typeId" TEXT NOT NULL,
  "serialNumber" TEXT, "manufacturer" TEXT, "model" TEXT,
  "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE', "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
  "electoralZoneId" TEXT, "pollingPlaceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssetMovement" (
  "id" TEXT NOT NULL, "assetId" TEXT NOT NULL, "fromZoneId" TEXT, "fromPollingPlaceId" TEXT,
  "toZoneId" TEXT, "toPollingPlaceId" TEXT, "originLabel" TEXT NOT NULL, "destinationLabel" TEXT NOT NULL,
  "responsibleId" TEXT, "responsibleName" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "statusBefore" "AssetStatus" NOT NULL, "statusAfter" "AssetStatus" NOT NULL,
  "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetMovement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssetAssignment" (
  "id" TEXT NOT NULL, "assetId" TEXT NOT NULL, "electoralZoneId" TEXT, "pollingPlaceId" TEXT,
  "assignedToId" TEXT, "assignedToName" TEXT, "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3), CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Incident" ADD COLUMN "assetId" TEXT;

CREATE UNIQUE INDEX "AssetType_key_key" ON "AssetType"("key");
CREATE INDEX "AssetType_active_name_idx" ON "AssetType"("active", "name");
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");
CREATE INDEX "Asset_typeId_status_idx" ON "Asset"("typeId", "status");
CREATE INDEX "Asset_electoralZoneId_status_idx" ON "Asset"("electoralZoneId", "status");
CREATE INDEX "Asset_pollingPlaceId_status_idx" ON "Asset"("pollingPlaceId", "status");
CREATE INDEX "Asset_condition_idx" ON "Asset"("condition");
CREATE INDEX "AssetMovement_assetId_movedAt_idx" ON "AssetMovement"("assetId", "movedAt");
CREATE INDEX "AssetMovement_toZoneId_movedAt_idx" ON "AssetMovement"("toZoneId", "movedAt");
CREATE INDEX "AssetMovement_toPollingPlaceId_movedAt_idx" ON "AssetMovement"("toPollingPlaceId", "movedAt");
CREATE INDEX "AssetAssignment_assetId_assignedAt_idx" ON "AssetAssignment"("assetId", "assignedAt");
CREATE INDEX "AssetAssignment_pollingPlaceId_endedAt_idx" ON "AssetAssignment"("pollingPlaceId", "endedAt");
CREATE INDEX "Incident_assetId_idx" ON "Incident"("assetId");

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AssetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_fromZoneId_fkey" FOREIGN KEY ("fromZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_fromPollingPlaceId_fkey" FOREIGN KEY ("fromPollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_toZoneId_fkey" FOREIGN KEY ("toZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_toPollingPlaceId_fkey" FOREIGN KEY ("toPollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
