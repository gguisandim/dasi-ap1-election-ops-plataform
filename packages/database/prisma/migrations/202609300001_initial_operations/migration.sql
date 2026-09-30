CREATE TYPE "ElectionStatus" AS ENUM ('PLANNING', 'PREPARATION', 'IN_PROGRESS', 'FINISHED', 'ARCHIVED');
CREATE TYPE "ElectionType" AS ENUM ('GENERAL', 'MUNICIPAL', 'SUPPLEMENTARY', 'REFERENDUM');
CREATE TYPE "RoundStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');
CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "MonitoringStatus" AS ENUM ('NORMAL', 'ATTENTION', 'CRITICAL', 'OFFLINE');

CREATE TABLE "Election" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "year" INTEGER NOT NULL,
  "type" "ElectionType" NOT NULL, "status" "ElectionStatus" NOT NULL DEFAULT 'PLANNING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ElectionRound" (
  "id" TEXT NOT NULL, "electionId" TEXT NOT NULL, "roundNumber" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL, "status" "RoundStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ElectionRound_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ElectoralZone" (
  "id" TEXT NOT NULL, "electionId" TEXT NOT NULL, "number" INTEGER NOT NULL, "name" TEXT NOT NULL,
  "municipality" TEXT NOT NULL, "state" CHAR(2) NOT NULL, "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ElectoralZone_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PollingPlace" (
  "id" TEXT NOT NULL, "electoralZoneId" TEXT NOT NULL, "name" TEXT NOT NULL, "address" TEXT NOT NULL,
  "district" TEXT NOT NULL, "city" TEXT NOT NULL, "state" CHAR(2) NOT NULL,
  "latitude" DECIMAL(9,6), "longitude" DECIMAL(9,6), "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "monitoringStatus" "MonitoringStatus" NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PollingPlace_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PollingSection" (
  "id" TEXT NOT NULL, "pollingPlaceId" TEXT NOT NULL, "number" INTEGER NOT NULL,
  "registeredVoters" INTEGER NOT NULL, "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PollingSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Election_year_status_idx" ON "Election"("year", "status");
CREATE UNIQUE INDEX "ElectionRound_electionId_roundNumber_key" ON "ElectionRound"("electionId", "roundNumber");
CREATE INDEX "ElectionRound_date_status_idx" ON "ElectionRound"("date", "status");
CREATE UNIQUE INDEX "ElectoralZone_electionId_number_key" ON "ElectoralZone"("electionId", "number");
CREATE INDEX "ElectoralZone_municipality_state_idx" ON "ElectoralZone"("municipality", "state");
CREATE INDEX "PollingPlace_city_state_idx" ON "PollingPlace"("city", "state");
CREATE INDEX "PollingPlace_electoralZoneId_monitoringStatus_idx" ON "PollingPlace"("electoralZoneId", "monitoringStatus");
CREATE UNIQUE INDEX "PollingSection_pollingPlaceId_number_key" ON "PollingSection"("pollingPlaceId", "number");
CREATE INDEX "PollingSection_status_idx" ON "PollingSection"("status");

ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectoralZone" ADD CONSTRAINT "ElectoralZone_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollingPlace" ADD CONSTRAINT "PollingPlace_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollingSection" ADD CONSTRAINT "PollingSection_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
