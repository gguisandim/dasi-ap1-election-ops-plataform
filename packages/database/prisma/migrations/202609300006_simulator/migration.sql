CREATE TYPE "SimulationStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'FINISHED', 'CANCELLED');
CREATE TYPE "FailureProbability" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TABLE "SimulationScenario" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "configuration" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SimulationScenario_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Simulation" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "electionId" TEXT NOT NULL, "scenarioId" TEXT,
  "status" "SimulationStatus" NOT NULL DEFAULT 'DRAFT', "speed" INTEGER NOT NULL DEFAULT 1,
  "probability" "FailureProbability" NOT NULL DEFAULT 'LOW', "connectivity" BOOLEAN NOT NULL DEFAULT true,
  "equipment" BOOLEAN NOT NULL DEFAULT true, "transmission" BOOLEAN NOT NULL DEFAULT true,
  "logistics" BOOLEAN NOT NULL DEFAULT true, "applyToOperations" BOOLEAN NOT NULL DEFAULT false,
  "elapsedSeconds" INTEGER NOT NULL DEFAULT 0, "startedAt" TIMESTAMP(3), "pausedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3), "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SimulationEvent" (
  "id" TEXT NOT NULL, "simulationId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "offsetSeconds" INTEGER NOT NULL, "payload" JSONB, "incidentId" TEXT,
  "assetId" TEXT, "pollingPlaceId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SimulationScenario_active_name_idx" ON "SimulationScenario"("active", "name");
CREATE INDEX "Simulation_electionId_status_idx" ON "Simulation"("electionId", "status");
CREATE INDEX "Simulation_createdAt_idx" ON "Simulation"("createdAt");
CREATE INDEX "SimulationEvent_simulationId_offsetSeconds_idx" ON "SimulationEvent"("simulationId", "offsetSeconds");
CREATE INDEX "SimulationEvent_incidentId_idx" ON "SimulationEvent"("incidentId");
CREATE INDEX "Incident_simulationId_idx" ON "Incident"("simulationId");
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "SimulationScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimulationEvent" ADD CONSTRAINT "SimulationEvent_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SimulationEvent" ADD CONSTRAINT "SimulationEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimulationEvent" ADD CONSTRAINT "SimulationEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimulationEvent" ADD CONSTRAINT "SimulationEvent_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
