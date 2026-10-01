CREATE TYPE "FieldTeamStatus" AS ENUM ('ACTIVE', 'STANDBY', 'INACTIVE');
CREATE TYPE "MemberAvailability" AS ENUM ('AVAILABLE', 'ASSIGNED', 'ON_DUTY', 'UNAVAILABLE', 'OFF_DUTY');
CREATE TYPE "FieldAllocationStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "FieldCheckType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

CREATE TABLE "FieldTeam" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL, "electionId" TEXT NOT NULL,
  "responsibleName" TEXT NOT NULL, "status" "FieldTeamStatus" NOT NULL DEFAULT 'ACTIVE', "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldTeam_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FieldRole" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldRole_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FieldSpecialty" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldSpecialty_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FieldMember" (
  "id" TEXT NOT NULL, "teamId" TEXT NOT NULL, "roleId" TEXT NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT,
  "status" "MemberAvailability" NOT NULL DEFAULT 'AVAILABLE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldMember_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FieldMemberSpecialty" (
  "id" TEXT NOT NULL, "memberId" TEXT NOT NULL, "specialtyId" TEXT NOT NULL,
  CONSTRAINT "FieldMemberSpecialty_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FieldShift" (
  "id" TEXT NOT NULL, "teamId" TEXT NOT NULL, "memberId" TEXT, "electoralZoneId" TEXT, "pollingPlaceId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldShift_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FieldAllocation" (
  "id" TEXT NOT NULL, "electionId" TEXT NOT NULL, "teamId" TEXT, "memberId" TEXT, "electoralZoneId" TEXT, "pollingPlaceId" TEXT,
  "routeId" TEXT, "activity" TEXT, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3),
  "status" "FieldAllocationStatus" NOT NULL DEFAULT 'SCHEDULED', "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldAllocation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FieldCheckEvent" (
  "id" TEXT NOT NULL, "memberId" TEXT NOT NULL, "electoralZoneId" TEXT, "pollingPlaceId" TEXT,
  "type" "FieldCheckType" NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FieldCheckEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FieldTeam_code_key" ON "FieldTeam"("code");
CREATE INDEX "FieldTeam_electionId_status_idx" ON "FieldTeam"("electionId", "status");
CREATE INDEX "FieldTeam_responsibleName_idx" ON "FieldTeam"("responsibleName");
CREATE UNIQUE INDEX "FieldRole_key_key" ON "FieldRole"("key");
CREATE INDEX "FieldRole_active_name_idx" ON "FieldRole"("active", "name");
CREATE UNIQUE INDEX "FieldSpecialty_key_key" ON "FieldSpecialty"("key");
CREATE INDEX "FieldSpecialty_active_name_idx" ON "FieldSpecialty"("active", "name");
CREATE INDEX "FieldMember_teamId_status_idx" ON "FieldMember"("teamId", "status");
CREATE INDEX "FieldMember_roleId_idx" ON "FieldMember"("roleId");
CREATE INDEX "FieldMember_name_idx" ON "FieldMember"("name");
CREATE UNIQUE INDEX "FieldMemberSpecialty_memberId_specialtyId_key" ON "FieldMemberSpecialty"("memberId", "specialtyId");
CREATE INDEX "FieldMemberSpecialty_specialtyId_idx" ON "FieldMemberSpecialty"("specialtyId");
CREATE INDEX "FieldShift_startsAt_endsAt_idx" ON "FieldShift"("startsAt", "endsAt");
CREATE INDEX "FieldShift_teamId_startsAt_idx" ON "FieldShift"("teamId", "startsAt");
CREATE INDEX "FieldShift_memberId_startsAt_idx" ON "FieldShift"("memberId", "startsAt");
CREATE INDEX "FieldAllocation_electionId_status_idx" ON "FieldAllocation"("electionId", "status");
CREATE INDEX "FieldAllocation_electoralZoneId_status_idx" ON "FieldAllocation"("electoralZoneId", "status");
CREATE INDEX "FieldAllocation_pollingPlaceId_status_idx" ON "FieldAllocation"("pollingPlaceId", "status");
CREATE INDEX "FieldAllocation_routeId_idx" ON "FieldAllocation"("routeId");
CREATE INDEX "FieldCheckEvent_memberId_occurredAt_idx" ON "FieldCheckEvent"("memberId", "occurredAt");
CREATE INDEX "FieldCheckEvent_pollingPlaceId_occurredAt_idx" ON "FieldCheckEvent"("pollingPlaceId", "occurredAt");

ALTER TABLE "FieldTeam" ADD CONSTRAINT "FieldTeam_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldMember" ADD CONSTRAINT "FieldMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FieldTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldMember" ADD CONSTRAINT "FieldMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "FieldRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldMemberSpecialty" ADD CONSTRAINT "FieldMemberSpecialty_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FieldMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldMemberSpecialty" ADD CONSTRAINT "FieldMemberSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "FieldSpecialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShift" ADD CONSTRAINT "FieldShift_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FieldTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShift" ADD CONSTRAINT "FieldShift_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FieldMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldShift" ADD CONSTRAINT "FieldShift_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldShift" ADD CONSTRAINT "FieldShift_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldAllocation" ADD CONSTRAINT "FieldAllocation_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldAllocation" ADD CONSTRAINT "FieldAllocation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FieldTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldAllocation" ADD CONSTRAINT "FieldAllocation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FieldMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldAllocation" ADD CONSTRAINT "FieldAllocation_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldAllocation" ADD CONSTRAINT "FieldAllocation_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldCheckEvent" ADD CONSTRAINT "FieldCheckEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FieldMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldCheckEvent" ADD CONSTRAINT "FieldCheckEvent_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldCheckEvent" ADD CONSTRAINT "FieldCheckEvent_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
