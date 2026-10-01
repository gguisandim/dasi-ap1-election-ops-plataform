CREATE TYPE "PreparationLocationType" AS ENUM ('POLLING_PLACE');
CREATE TYPE "PreparationChecklistStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'READY_FOR_APPROVAL', 'APPROVED', 'BLOCKED');
CREATE TYPE "PreparationChecklistItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');
CREATE TYPE "PreparationChecklistHistoryAction" AS ENUM ('CREATED', 'ASSIGNEE_CHANGED', 'ITEM_UPDATED', 'EVIDENCE_ADDED', 'BLOCKED', 'ITEM_COMPLETED', 'APPROVED', 'APPROVAL_REVOKED');

CREATE TABLE "PreparationChecklistTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "locationType" "PreparationLocationType" NOT NULL DEFAULT 'POLLING_PLACE',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreparationChecklistTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreparationChecklistTemplateItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreparationChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreparationChecklist" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "electoralZoneId" TEXT NOT NULL,
  "pollingPlaceId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "status" "PreparationChecklistStatus" NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreparationChecklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreparationChecklistItem" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "status" "PreparationChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
  "assigneeId" TEXT,
  "observation" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreparationChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreparationChecklistEvidence" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreparationChecklistEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreparationChecklistHistory" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" "PreparationChecklistHistoryAction" NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreparationChecklistHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PreparationChecklistTemplate_active_name_idx" ON "PreparationChecklistTemplate"("active", "name");
CREATE UNIQUE INDEX "PreparationChecklistTemplateItem_templateId_order_key" ON "PreparationChecklistTemplateItem"("templateId", "order");
CREATE INDEX "PreparationChecklist_electionId_status_idx" ON "PreparationChecklist"("electionId", "status");
CREATE INDEX "PreparationChecklist_electoralZoneId_status_idx" ON "PreparationChecklist"("electoralZoneId", "status");
CREATE INDEX "PreparationChecklist_pollingPlaceId_status_idx" ON "PreparationChecklist"("pollingPlaceId", "status");
CREATE INDEX "PreparationChecklist_assigneeId_status_idx" ON "PreparationChecklist"("assigneeId", "status");
CREATE INDEX "PreparationChecklist_templateId_idx" ON "PreparationChecklist"("templateId");
CREATE UNIQUE INDEX "PreparationChecklistItem_checklistId_order_key" ON "PreparationChecklistItem"("checklistId", "order");
CREATE INDEX "PreparationChecklistItem_checklistId_status_idx" ON "PreparationChecklistItem"("checklistId", "status");
CREATE INDEX "PreparationChecklistItem_assigneeId_status_idx" ON "PreparationChecklistItem"("assigneeId", "status");
CREATE INDEX "PreparationChecklistEvidence_itemId_createdAt_idx" ON "PreparationChecklistEvidence"("itemId", "createdAt");
CREATE INDEX "PreparationChecklistEvidence_recordedById_idx" ON "PreparationChecklistEvidence"("recordedById");
CREATE INDEX "PreparationChecklistHistory_checklistId_createdAt_idx" ON "PreparationChecklistHistory"("checklistId", "createdAt");
CREATE INDEX "PreparationChecklistHistory_actorId_createdAt_idx" ON "PreparationChecklistHistory"("actorId", "createdAt");

ALTER TABLE "PreparationChecklistTemplateItem" ADD CONSTRAINT "PreparationChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PreparationChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklist" ADD CONSTRAINT "PreparationChecklist_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklist" ADD CONSTRAINT "PreparationChecklist_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklist" ADD CONSTRAINT "PreparationChecklist_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklist" ADD CONSTRAINT "PreparationChecklist_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PreparationChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklist" ADD CONSTRAINT "PreparationChecklist_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklist" ADD CONSTRAINT "PreparationChecklist_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklistItem" ADD CONSTRAINT "PreparationChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "PreparationChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklistItem" ADD CONSTRAINT "PreparationChecklistItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklistEvidence" ADD CONSTRAINT "PreparationChecklistEvidence_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PreparationChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklistEvidence" ADD CONSTRAINT "PreparationChecklistEvidence_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklistHistory" ADD CONSTRAINT "PreparationChecklistHistory_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "PreparationChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationChecklistHistory" ADD CONSTRAINT "PreparationChecklistHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;