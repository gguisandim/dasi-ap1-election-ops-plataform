-- CreateEnum
CREATE TYPE "SimulationScenarioEventType" AS ENUM ('INCIDENT_CREATE', 'TRANSMISSION_FAILURE', 'TRANSMISSION_RECOVERY', 'ASSET_FAILURE', 'ASSET_RECOVERY');

-- CreateEnum
CREATE TYPE "SimulationTargetType" AS ENUM ('NONE', 'POLLING_PLACE', 'ZONE', 'ASSET', 'TRANSMISSION');

-- AlterTable
ALTER TABLE "SimulationScenario" ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "seed" INTEGER;

-- AlterTable
ALTER TABLE "Simulation" ADD COLUMN     "score" INTEGER,
ADD COLUMN     "scoreBreakdown" JSONB,
ADD COLUMN     "seed" INTEGER;

-- AlterTable
ALTER TABLE "SimulationEvent" ADD COLUMN     "result" TEXT,
ADD COLUMN     "scenarioEventId" TEXT,
ADD COLUMN     "severity" "IncidentSeverity";

-- AlterTable
ALTER TABLE "TransmissionAlert" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedById" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "resolvedById" TEXT;

-- CreateTable
CREATE TABLE "SimulationScenarioEvent" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "offsetSeconds" INTEGER NOT NULL,
    "type" "SimulationScenarioEventType" NOT NULL,
    "severity" "IncidentSeverity",
    "targetType" "SimulationTargetType" NOT NULL DEFAULT 'NONE',
    "targetId" TEXT,
    "probability" INTEGER NOT NULL DEFAULT 100,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationScenarioEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationScenarioEvent_scenarioId_offsetSeconds_idx" ON "SimulationScenarioEvent"("scenarioId", "offsetSeconds");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationScenarioEvent_scenarioId_offsetSeconds_type_key" ON "SimulationScenarioEvent"("scenarioId", "offsetSeconds", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationEvent_simulationId_scenarioEventId_key" ON "SimulationEvent"("simulationId", "scenarioEventId");

-- CreateIndex
CREATE INDEX "TransmissionAlert_status_createdAt_idx" ON "TransmissionAlert"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SimulationScenarioEvent" ADD CONSTRAINT "SimulationScenarioEvent_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "SimulationScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationEvent" ADD CONSTRAINT "SimulationEvent_scenarioEventId_fkey" FOREIGN KEY ("scenarioEventId") REFERENCES "SimulationScenarioEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionAlert" ADD CONSTRAINT "TransmissionAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmissionAlert" ADD CONSTRAINT "TransmissionAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

