ALTER TYPE "IncidentEventType" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGED';
ALTER TYPE "IncidentEventType" ADD VALUE IF NOT EXISTS 'ESCALATED';
ALTER TYPE "IncidentEventType" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "IncidentEventType" ADD VALUE IF NOT EXISTS 'UPDATED';

ALTER TABLE "Incident"
ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "acknowledgedById" TEXT,
ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "escalatedAt" TIMESTAMP(3),
ADD COLUMN "escalatedById" TEXT,
ADD COLUMN "escalationReason" TEXT;

ALTER TABLE "AuditEvent" ADD COLUMN "eventName" TEXT;

CREATE INDEX "Incident_status_escalationLevel_slaDeadline_idx"
ON "Incident"("status", "escalationLevel", "slaDeadline");

CREATE INDEX "AuditEvent_eventName_createdAt_idx"
ON "AuditEvent"("eventName", "createdAt");
