CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');
CREATE TYPE "IncidentEventType" AS ENUM ('INCIDENT_CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'COMMENT_ADDED', 'SEVERITY_CHANGED', 'RESOLVED', 'REOPENED', 'CLOSED');

CREATE TABLE "IncidentCategory" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IncidentCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'NEW',
  "electionId" TEXT NOT NULL,
  "electoralZoneId" TEXT,
  "pollingPlaceId" TEXT,
  "categoryId" TEXT NOT NULL,
  "createdById" TEXT,
  "assignedToId" TEXT,
  "assignedToName" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "slaDeadline" TIMESTAMP(3),
  "isSimulated" BOOLEAN NOT NULL DEFAULT false,
  "simulationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentEvent" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "type" "IncidentEventType" NOT NULL,
  "message" TEXT NOT NULL,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentAssignment" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "assignedToName" TEXT NOT NULL,
  "assignedById" TEXT,
  "reason" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "IncidentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncidentCategory_key_key" ON "IncidentCategory"("key");
CREATE INDEX "IncidentCategory_active_name_idx" ON "IncidentCategory"("active", "name");
CREATE UNIQUE INDEX "Incident_code_key" ON "Incident"("code");
CREATE INDEX "Incident_electionId_status_idx" ON "Incident"("electionId", "status");
CREATE INDEX "Incident_electoralZoneId_status_idx" ON "Incident"("electoralZoneId", "status");
CREATE INDEX "Incident_pollingPlaceId_status_idx" ON "Incident"("pollingPlaceId", "status");
CREATE INDEX "Incident_severity_status_idx" ON "Incident"("severity", "status");
CREATE INDEX "Incident_slaDeadline_idx" ON "Incident"("slaDeadline");
CREATE INDEX "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId", "createdAt");
CREATE INDEX "IncidentAssignment_incidentId_assignedAt_idx" ON "IncidentAssignment"("incidentId", "assignedAt");
CREATE INDEX "IncidentAssignment_assignedToId_idx" ON "IncidentAssignment"("assignedToId");

ALTER TABLE "Incident" ADD CONSTRAINT "Incident_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IncidentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentAssignment" ADD CONSTRAINT "IncidentAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
