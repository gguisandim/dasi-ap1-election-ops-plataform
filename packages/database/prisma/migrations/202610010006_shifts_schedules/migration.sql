CREATE TYPE "FieldShiftStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "FieldShiftAssignmentStatus" AS ENUM ('SCHEDULED', 'PRESENT', 'ABSENT', 'REPLACED', 'ON_CALL');
CREATE TYPE "FieldShiftHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'ASSIGNED', 'PRESENCE_REGISTERED', 'ABSENCE_REGISTERED', 'ON_CALL_REGISTERED', 'ON_CALL_ACTIVATED', 'REPLACED', 'STARTED', 'COMPLETED', 'CANCELLED', 'COVERAGE_INSUFFICIENT');

ALTER TABLE "FieldShift"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "requiredOperators" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "status" "FieldShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "FieldShiftAssignment" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "roleId" TEXT,
  "status" "FieldShiftAssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "presentAt" TIMESTAMP(3),
  "absenceReason" TEXT,
  "absenceRecordedAt" TIMESTAMP(3),
  "onCallActivatedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldShiftAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldShiftReplacement" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "originalAssignmentId" TEXT NOT NULL,
  "substituteAssignmentId" TEXT NOT NULL,
  "replacedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldShiftReplacement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldShiftHistory" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "actorId" TEXT,
  "action" "FieldShiftHistoryAction" NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldShiftHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FieldShift_status_startsAt_idx" ON "FieldShift"("status", "startsAt");
CREATE INDEX "FieldShift_electoralZoneId_startsAt_idx" ON "FieldShift"("electoralZoneId", "startsAt");
CREATE INDEX "FieldShift_pollingPlaceId_startsAt_idx" ON "FieldShift"("pollingPlaceId", "startsAt");
CREATE INDEX "FieldShiftAssignment_shiftId_status_idx" ON "FieldShiftAssignment"("shiftId", "status");
CREATE INDEX "FieldShiftAssignment_memberId_startsAt_endsAt_idx" ON "FieldShiftAssignment"("memberId", "startsAt", "endsAt");
CREATE UNIQUE INDEX "FieldShiftReplacement_originalAssignmentId_key" ON "FieldShiftReplacement"("originalAssignmentId");
CREATE UNIQUE INDEX "FieldShiftReplacement_substituteAssignmentId_key" ON "FieldShiftReplacement"("substituteAssignmentId");
CREATE INDEX "FieldShiftReplacement_shiftId_createdAt_idx" ON "FieldShiftReplacement"("shiftId", "createdAt");
CREATE INDEX "FieldShiftHistory_shiftId_createdAt_idx" ON "FieldShiftHistory"("shiftId", "createdAt");
CREATE INDEX "FieldShiftHistory_actorId_createdAt_idx" ON "FieldShiftHistory"("actorId", "createdAt");

ALTER TABLE "FieldShiftAssignment" ADD CONSTRAINT "FieldShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "FieldShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShiftAssignment" ADD CONSTRAINT "FieldShiftAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FieldMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldShiftAssignment" ADD CONSTRAINT "FieldShiftAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "FieldRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldShiftReplacement" ADD CONSTRAINT "FieldShiftReplacement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "FieldShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShiftReplacement" ADD CONSTRAINT "FieldShiftReplacement_originalAssignmentId_fkey" FOREIGN KEY ("originalAssignmentId") REFERENCES "FieldShiftAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShiftReplacement" ADD CONSTRAINT "FieldShiftReplacement_substituteAssignmentId_fkey" FOREIGN KEY ("substituteAssignmentId") REFERENCES "FieldShiftAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShiftReplacement" ADD CONSTRAINT "FieldShiftReplacement_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldShiftHistory" ADD CONSTRAINT "FieldShiftHistory_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "FieldShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShiftHistory" ADD CONSTRAINT "FieldShiftHistory_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "FieldShiftAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldShiftHistory" ADD CONSTRAINT "FieldShiftHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
