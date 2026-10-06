-- CreateEnum
CREATE TYPE "ShiftHandoverStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftHandoverHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'INCIDENT_ADDED', 'INCIDENT_REMOVED', 'TASK_ADDED', 'TASK_REMOVED', 'ASSET_ADDED', 'ASSET_REMOVED', 'SUBMITTED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ShiftHandover" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "pendingNotes" TEXT,
    "observations" TEXT,
    "status" "ShiftHandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftHandoverIncident" (
    "handoverId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftHandoverIncident_pkey" PRIMARY KEY ("handoverId", "incidentId")
);

CREATE TABLE "ShiftHandoverTask" (
    "handoverId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftHandoverTask_pkey" PRIMARY KEY ("handoverId", "taskId")
);

CREATE TABLE "ShiftHandoverAsset" (
    "handoverId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftHandoverAsset_pkey" PRIMARY KEY ("handoverId", "assetId")
);

CREATE TABLE "ShiftHandoverHistory" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "ShiftHandoverHistoryAction" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftHandoverHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftHandover_status_createdAt_idx" ON "ShiftHandover"("status", "createdAt");
CREATE INDEX "ShiftHandover_recipientUserId_status_idx" ON "ShiftHandover"("recipientUserId", "status");
CREATE INDEX "ShiftHandover_senderUserId_createdAt_idx" ON "ShiftHandover"("senderUserId", "createdAt");
CREATE INDEX "ShiftHandover_shiftId_createdAt_idx" ON "ShiftHandover"("shiftId", "createdAt");
CREATE INDEX "ShiftHandover_submittedAt_idx" ON "ShiftHandover"("submittedAt");
CREATE INDEX "ShiftHandoverIncident_incidentId_idx" ON "ShiftHandoverIncident"("incidentId");
CREATE INDEX "ShiftHandoverTask_taskId_idx" ON "ShiftHandoverTask"("taskId");
CREATE INDEX "ShiftHandoverAsset_assetId_idx" ON "ShiftHandoverAsset"("assetId");
CREATE INDEX "ShiftHandoverHistory_handoverId_createdAt_idx" ON "ShiftHandoverHistory"("handoverId", "createdAt");
CREATE INDEX "ShiftHandoverHistory_actorId_createdAt_idx" ON "ShiftHandoverHistory"("actorId", "createdAt");

ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "FieldShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverIncident" ADD CONSTRAINT "ShiftHandoverIncident_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "ShiftHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverIncident" ADD CONSTRAINT "ShiftHandoverIncident_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverTask" ADD CONSTRAINT "ShiftHandoverTask_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "ShiftHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverTask" ADD CONSTRAINT "ShiftHandoverTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverAsset" ADD CONSTRAINT "ShiftHandoverAsset_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "ShiftHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverAsset" ADD CONSTRAINT "ShiftHandoverAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverHistory" ADD CONSTRAINT "ShiftHandoverHistory_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "ShiftHandover"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverHistory" ADD CONSTRAINT "ShiftHandoverHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
