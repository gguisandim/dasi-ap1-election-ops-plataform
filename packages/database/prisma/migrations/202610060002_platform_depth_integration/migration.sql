-- CreateEnum
CREATE TYPE "SimulationScenarioStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SimulationDecisionKind" AS ENUM ('ESCALATE', 'DISPATCH_TEAM', 'ACTIVATE_FAILOVER', 'REQUEST_RESOURCE', 'RECLASSIFY_SEVERITY', 'ACCEPT_DEGRADATION', 'ABORT_OPERATION');

-- CreateEnum
CREATE TYPE "TransmissionFailoverStatus" AS ENUM ('ACTIVE', 'RECOVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditEventSeverity" AS ENUM ('INFO', 'NOTICE', 'WARNING', 'CRITICAL');

-- AlterEnum
ALTER TYPE "SimulationStatus" ADD VALUE 'FAILED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'INCIDENT_CRITICAL';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'OPERATIONAL_DELAY';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'CONNECTIVITY_LOSS';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'TRANSMISSION_DEGRADATION';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'TEAM_UNAVAILABLE';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'OPERATOR_ABSENCE';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'VEHICLE_UNAVAILABLE';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'ROUTE_FAILURE';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'RESOURCE_REQUEST_CREATE';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'PREPARATION_BLOCKER';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'HANDOVER_PENDING';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'WORKFORCE_SHORTAGE';
ALTER TYPE "SimulationScenarioEventType" ADD VALUE 'SERVICE_RECOVERY';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "category" TEXT,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "electionId" TEXT,
ADD COLUMN     "electoralZoneId" TEXT,
ADD COLUMN     "severity" "AuditEventSeverity";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "correlationId" TEXT;

-- AlterTable
ALTER TABLE "SimulationScenario" ADD COLUMN     "clonedFromId" TEXT,
ADD COLUMN     "electionId" TEXT,
ADD COLUMN     "failureCriteria" JSONB,
ADD COLUMN     "initialConditions" JSONB,
ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "objectives" JSONB,
ADD COLUMN     "scoreWeights" JSONB,
ADD COLUMN     "speed" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "SimulationScenarioStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "successCriteria" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SimulationScenarioEvent" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "impact" TEXT;

-- AlterTable
ALTER TABLE "Simulation" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "metrics" JSONB,
ADD COLUMN     "simulatedStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SimulationSnapshot" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "offsetSeconds" INTEGER NOT NULL,
    "health" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationDecision" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "offsetSeconds" INTEGER NOT NULL,
    "kind" "SimulationDecisionKind" NOT NULL,
    "rationale" TEXT NOT NULL,
    "actorId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransmissionProvider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "slaTargetUptimePercent" DECIMAL(5,2),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransmissionProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransmissionCircuit" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "providerId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "technology" TEXT,
    "bandwidthMbps" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "status" "ConnectivityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeenAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransmissionCircuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransmissionStateTransition" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "circuitId" TEXT,
    "from" "ConnectivityStatus" NOT NULL,
    "to" "ConnectivityStatus" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "durationSeconds" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransmissionStateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransmissionFailover" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "fromCircuitId" TEXT,
    "toCircuitId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TransmissionFailoverStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" TIMESTAMP(3),
    "recoveredById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "TransmissionFailover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSavedView" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "granularity" TEXT NOT NULL DEFAULT 'day',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationSnapshot_simulationId_offsetSeconds_idx" ON "SimulationSnapshot"("simulationId", "offsetSeconds");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationSnapshot_simulationId_offsetSeconds_key" ON "SimulationSnapshot"("simulationId", "offsetSeconds");

-- CreateIndex
CREATE INDEX "SimulationDecision_simulationId_offsetSeconds_idx" ON "SimulationDecision"("simulationId", "offsetSeconds");

-- CreateIndex
CREATE INDEX "SimulationDecision_kind_createdAt_idx" ON "SimulationDecision"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "SimulationDecision_actorId_createdAt_idx" ON "SimulationDecision"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransmissionProvider_code_key" ON "TransmissionProvider"("code");

-- CreateIndex
CREATE INDEX "TransmissionProvider_active_name_idx" ON "TransmissionProvider"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TransmissionCircuit_code_key" ON "TransmissionCircuit"("code");

-- CreateIndex
CREATE INDEX "TransmissionCircuit_pointId_isPrimary_idx" ON "TransmissionCircuit"("pointId", "isPrimary");

-- CreateIndex
CREATE INDEX "TransmissionCircuit_providerId_status_idx" ON "TransmissionCircuit"("providerId", "status");

-- CreateIndex
CREATE INDEX "TransmissionCircuit_status_idx" ON "TransmissionCircuit"("status");

-- CreateIndex
CREATE INDEX "TransmissionStateTransition_pointId_occurredAt_idx" ON "TransmissionStateTransition"("pointId", "occurredAt");

-- CreateIndex
CREATE INDEX "TransmissionStateTransition_to_occurredAt_idx" ON "TransmissionStateTransition"("to", "occurredAt");

-- CreateIndex
CREATE INDEX "TransmissionStateTransition_pointId_circuitId_idx" ON "TransmissionStateTransition"("pointId", "circuitId");

-- CreateIndex
CREATE INDEX "TransmissionStateTransition_actorId_createdAt_idx" ON "TransmissionStateTransition"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "TransmissionFailover_pointId_startedAt_idx" ON "TransmissionFailover"("pointId", "startedAt");

-- CreateIndex
CREATE INDEX "TransmissionFailover_status_startedAt_idx" ON "TransmissionFailover"("status", "startedAt");

-- CreateIndex
CREATE INDEX "TransmissionFailover_toCircuitId_idx" ON "TransmissionFailover"("toCircuitId");

-- CreateIndex
CREATE INDEX "ReportSavedView_ownerId_isDefault_idx" ON "ReportSavedView"("ownerId", "isDefault");

-- CreateIndex
CREATE INDEX "ReportSavedView_shared_updatedAt_idx" ON "ReportSavedView"("shared", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSavedView_ownerId_name_key" ON "ReportSavedView"("ownerId", "name");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "AuditEvent_category_createdAt_idx" ON "AuditEvent"("category", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_severity_createdAt_idx" ON "AuditEvent"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_electionId_createdAt_idx" ON "AuditEvent"("electionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_electoralZoneId_createdAt_idx" ON "AuditEvent"("electoralZoneId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_correlationId_idx" ON "Notification"("correlationId");

-- CreateIndex
CREATE INDEX "SimulationScenario_status_name_idx" ON "SimulationScenario"("status", "name");

-- CreateIndex
CREATE INDEX "SimulationScenario_isTemplate_active_idx" ON "SimulationScenario"("isTemplate", "active");

-- CreateIndex
CREATE INDEX "SimulationScenario_electionId_status_idx" ON "SimulationScenario"("electionId", "status");

-- CreateIndex
CREATE INDEX "Simulation_scenarioId_status_idx" ON "Simulation"("scenarioId", "status");

-- AddForeignKey
ALTER TABLE "SimulationScenario" ADD CONSTRAINT "SimulationScenario_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationScenario" ADD CONSTRAINT "SimulationScenario_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "SimulationScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationSnapshot" ADD CONSTRAINT "SimulationSnapshot_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationDecision" ADD CONSTRAINT "SimulationDecision_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationDecision" ADD CONSTRAINT "SimulationDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionCircuit" ADD CONSTRAINT "TransmissionCircuit_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "TransmissionPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionCircuit" ADD CONSTRAINT "TransmissionCircuit_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "TransmissionProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionStateTransition" ADD CONSTRAINT "TransmissionStateTransition_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "TransmissionPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionStateTransition" ADD CONSTRAINT "TransmissionStateTransition_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "TransmissionCircuit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionStateTransition" ADD CONSTRAINT "TransmissionStateTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionFailover" ADD CONSTRAINT "TransmissionFailover_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "TransmissionPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionFailover" ADD CONSTRAINT "TransmissionFailover_fromCircuitId_fkey" FOREIGN KEY ("fromCircuitId") REFERENCES "TransmissionCircuit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionFailover" ADD CONSTRAINT "TransmissionFailover_toCircuitId_fkey" FOREIGN KEY ("toCircuitId") REFERENCES "TransmissionCircuit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionFailover" ADD CONSTRAINT "TransmissionFailover_recoveredById_fkey" FOREIGN KEY ("recoveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSavedView" ADD CONSTRAINT "ReportSavedView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

