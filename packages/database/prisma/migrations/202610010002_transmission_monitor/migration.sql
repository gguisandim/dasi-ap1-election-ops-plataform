CREATE TYPE "TransmissionStatus" AS ENUM ('WAITING', 'QUEUED', 'TRANSMITTING', 'SUCCESS', 'FAILED', 'RETRYING', 'OFFLINE');
CREATE TYPE "ConnectivityStatus" AS ENUM ('ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN');
CREATE TYPE "TransmissionAttemptResult" AS ENUM ('SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED');
CREATE TYPE "TransmissionEventType" AS ENUM ('QUEUED', 'STARTED', 'FAILED', 'RETRY', 'SUCCESS', 'CONNECTIVITY_CHANGED', 'ALERT_CREATED', 'NOTE_ADDED');
CREATE TYPE "TransmissionAlertType" AS ENUM ('REPEATED_FAILURE', 'POINT_OFFLINE', 'TRANSMISSION_DELAYED', 'TOO_MANY_ATTEMPTS', 'DEADLINE_NEAR');
CREATE TYPE "TransmissionAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "TransmissionPoint" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "electoralZoneId" TEXT NOT NULL,
  "pollingPlaceId" TEXT NOT NULL,
  "identification" TEXT NOT NULL,
  "status" "TransmissionStatus" NOT NULL DEFAULT 'WAITING',
  "connectivity" "ConnectivityStatus" NOT NULL DEFAULT 'UNKNOWN',
  "lastActivity" TIMESTAMP(3),
  "observations" TEXT,
  "latencyMs" INTEGER,
  "lastCheckedAt" TIMESTAMP(3),
  "connectionMethod" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 3,
  "queuedAt" TIMESTAMP(3),
  "operationalDeadline" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransmissionPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransmissionAttempt" (
  "id" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "result" "TransmissionAttemptResult" NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransmissionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransmissionTimelineEvent" (
  "id" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "type" "TransmissionEventType" NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransmissionTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransmissionAlert" (
  "id" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "type" "TransmissionAlertType" NOT NULL,
  "status" "TransmissionAlertStatus" NOT NULL DEFAULT 'OPEN',
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "TransmissionAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransmissionPoint_identification_key" ON "TransmissionPoint"("identification");
CREATE INDEX "TransmissionPoint_electionId_status_idx" ON "TransmissionPoint"("electionId", "status");
CREATE INDEX "TransmissionPoint_electoralZoneId_status_idx" ON "TransmissionPoint"("electoralZoneId", "status");
CREATE INDEX "TransmissionPoint_pollingPlaceId_idx" ON "TransmissionPoint"("pollingPlaceId");
CREATE INDEX "TransmissionPoint_priority_queuedAt_idx" ON "TransmissionPoint"("priority", "queuedAt");
CREATE INDEX "TransmissionPoint_connectivity_idx" ON "TransmissionPoint"("connectivity");
CREATE UNIQUE INDEX "TransmissionAttempt_pointId_number_key" ON "TransmissionAttempt"("pointId", "number");
CREATE INDEX "TransmissionAttempt_pointId_startedAt_idx" ON "TransmissionAttempt"("pointId", "startedAt");
CREATE INDEX "TransmissionTimelineEvent_pointId_createdAt_idx" ON "TransmissionTimelineEvent"("pointId", "createdAt");
CREATE INDEX "TransmissionAlert_pointId_status_idx" ON "TransmissionAlert"("pointId", "status");
CREATE INDEX "TransmissionAlert_type_status_idx" ON "TransmissionAlert"("type", "status");

ALTER TABLE "TransmissionPoint" ADD CONSTRAINT "TransmissionPoint_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransmissionPoint" ADD CONSTRAINT "TransmissionPoint_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransmissionPoint" ADD CONSTRAINT "TransmissionPoint_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransmissionAttempt" ADD CONSTRAINT "TransmissionAttempt_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "TransmissionPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransmissionTimelineEvent" ADD CONSTRAINT "TransmissionTimelineEvent_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "TransmissionPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransmissionAlert" ADD CONSTRAINT "TransmissionAlert_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "TransmissionPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
