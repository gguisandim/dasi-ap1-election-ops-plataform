-- CreateEnum
CREATE TYPE "RiskProbability" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "RiskImpact" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('IDENTIFIED', 'ASSESSED', 'MITIGATING', 'MONITORING', 'ACCEPTED', 'CLOSED', 'MATERIALIZED');

-- CreateEnum
CREATE TYPE "RiskMitigationStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskEventType" AS ENUM ('CREATED', 'ASSESSED', 'SCORE_CHANGED', 'OWNER_CHANGED', 'STATUS_CHANGED', 'MITIGATION_ADDED', 'MITIGATION_UPDATED', 'MITIGATION_COMPLETED', 'MATERIALIZED', 'CLOSED', 'REOPENED', 'NOTE_ADDED');

-- CreateTable
CREATE TABLE "RiskCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "electoralZoneId" TEXT,
    "pollingPlaceId" TEXT,
    "categoryId" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerName" TEXT NOT NULL,
    "responsibleId" TEXT,
    "responsibleName" TEXT NOT NULL,
    "probability" "RiskProbability" NOT NULL DEFAULT 'MEDIUM',
    "impact" "RiskImpact" NOT NULL DEFAULT 'MEDIUM',
    "score" INTEGER NOT NULL DEFAULT 9,
    "level" "RiskLevel" NOT NULL DEFAULT 'MODERATE',
    "status" "RiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "materializedAt" TIMESTAMP(3),
    "actualImpact" TEXT,
    "materializationNotes" TEXT,
    "incidentId" TEXT,
    "observations" TEXT,
    "mitigationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMitigation" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "responsibleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "RiskMitigationStatus" NOT NULL DEFAULT 'PLANNED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "evidenceId" TEXT,
    "evidenceLabel" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskMitigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "type" "RiskEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskCategory_key_key" ON "RiskCategory"("key");

-- CreateIndex
CREATE INDEX "RiskCategory_active_name_idx" ON "RiskCategory"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_code_key" ON "Risk"("code");

-- CreateIndex
CREATE INDEX "Risk_electionId_status_idx" ON "Risk"("electionId", "status");

-- CreateIndex
CREATE INDEX "Risk_level_status_idx" ON "Risk"("level", "status");

-- CreateIndex
CREATE INDEX "Risk_electoralZoneId_status_idx" ON "Risk"("electoralZoneId", "status");

-- CreateIndex
CREATE INDEX "Risk_pollingPlaceId_status_idx" ON "Risk"("pollingPlaceId", "status");

-- CreateIndex
CREATE INDEX "Risk_categoryId_idx" ON "Risk"("categoryId");

-- CreateIndex
CREATE INDEX "Risk_probability_impact_idx" ON "Risk"("probability", "impact");

-- CreateIndex
CREATE INDEX "Risk_dueDate_idx" ON "Risk"("dueDate");

-- CreateIndex
CREATE INDEX "RiskMitigation_riskId_status_idx" ON "RiskMitigation"("riskId", "status");

-- CreateIndex
CREATE INDEX "RiskMitigation_dueDate_status_idx" ON "RiskMitigation"("dueDate", "status");

-- CreateIndex
CREATE INDEX "RiskEvent_riskId_createdAt_idx" ON "RiskEvent"("riskId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskEvent_type_createdAt_idx" ON "RiskEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RiskCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskMitigation" ADD CONSTRAINT "RiskMitigation_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvent" ADD CONSTRAINT "RiskEvent_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

