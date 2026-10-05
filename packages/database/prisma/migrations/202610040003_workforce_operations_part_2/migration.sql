-- CreateEnum
CREATE TYPE "FieldDispatchStatus" AS ENUM ('REQUESTED', 'DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldDispatchEventType" AS ENUM ('CREATED', 'DISPATCHED', 'ACCEPTED', 'REJECTED', 'DEPARTED', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED', 'ASSIGNED', 'UPDATED');

-- CreateEnum
CREATE TYPE "CapabilityMatch" AS ENUM ('MATCH', 'PARTIAL', 'NO_MATCH');

-- CreateEnum
CREATE TYPE "TaskExecutionMode" AS ENUM ('OFFICE', 'FIELD', 'MIXED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "executionMode" "TaskExecutionMode" NOT NULL DEFAULT 'OFFICE',
ADD COLUMN     "requiredTeamSize" INTEGER;

-- CreateTable
CREATE TABLE "FieldDispatch" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "memberId" TEXT,
    "taskId" TEXT,
    "incidentId" TEXT,
    "status" "FieldDispatchStatus" NOT NULL DEFAULT 'REQUESTED',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "locationLabel" TEXT,
    "electoralZoneId" TEXT,
    "pollingPlaceId" TEXT,
    "capabilityMatch" "CapabilityMatch",
    "capabilityOverrideReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "completionSummary" TEXT,
    "completionResult" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDispatchEvent" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "type" "FieldDispatchEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "fromStatus" "FieldDispatchStatus",
    "toStatus" "FieldDispatchStatus",
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldDispatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSpecialtyRequirement" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL,

    CONSTRAINT "TaskSpecialtyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldDispatch_status_priority_idx" ON "FieldDispatch"("status", "priority");

-- CreateIndex
CREATE INDEX "FieldDispatch_teamId_status_idx" ON "FieldDispatch"("teamId", "status");

-- CreateIndex
CREATE INDEX "FieldDispatch_memberId_status_idx" ON "FieldDispatch"("memberId", "status");

-- CreateIndex
CREATE INDEX "FieldDispatch_taskId_idx" ON "FieldDispatch"("taskId");

-- CreateIndex
CREATE INDEX "FieldDispatch_incidentId_idx" ON "FieldDispatch"("incidentId");

-- CreateIndex
CREATE INDEX "FieldDispatch_requestedAt_idx" ON "FieldDispatch"("requestedAt");

-- CreateIndex
CREATE INDEX "FieldDispatchEvent_dispatchId_createdAt_idx" ON "FieldDispatchEvent"("dispatchId", "createdAt");

-- CreateIndex
CREATE INDEX "FieldDispatchEvent_actorId_createdAt_idx" ON "FieldDispatchEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskSpecialtyRequirement_specialtyId_idx" ON "TaskSpecialtyRequirement"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSpecialtyRequirement_taskId_specialtyId_key" ON "TaskSpecialtyRequirement"("taskId", "specialtyId");

-- AddForeignKey
ALTER TABLE "FieldDispatch" ADD CONSTRAINT "FieldDispatch_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FieldTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDispatch" ADD CONSTRAINT "FieldDispatch_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FieldMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDispatch" ADD CONSTRAINT "FieldDispatch_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDispatch" ADD CONSTRAINT "FieldDispatch_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDispatch" ADD CONSTRAINT "FieldDispatch_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDispatch" ADD CONSTRAINT "FieldDispatch_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDispatch" ADD CONSTRAINT "FieldDispatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDispatchEvent" ADD CONSTRAINT "FieldDispatchEvent_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "FieldDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDispatchEvent" ADD CONSTRAINT "FieldDispatchEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSpecialtyRequirement" ADD CONSTRAINT "TaskSpecialtyRequirement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSpecialtyRequirement" ADD CONSTRAINT "TaskSpecialtyRequirement_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "FieldSpecialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

