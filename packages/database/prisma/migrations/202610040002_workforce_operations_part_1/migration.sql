CREATE TABLE "FieldMemberUnavailability" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldMemberUnavailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldShiftSpecialtyRequirement" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "specialtyId" TEXT NOT NULL,
  "requiredCount" INTEGER NOT NULL,
  CONSTRAINT "FieldShiftSpecialtyRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldShiftTemplate" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "electoralZoneId" TEXT,
  "pollingPlaceId" TEXT,
  "name" TEXT NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "requiredOperators" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldShiftTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldShiftTemplateSpecialtyRequirement" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "specialtyId" TEXT NOT NULL,
  "requiredCount" INTEGER NOT NULL,
  CONSTRAINT "FieldShiftTemplateSpecialtyRequirement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FieldMemberUnavailability_memberId_startsAt_endsAt_idx" ON "FieldMemberUnavailability"("memberId", "startsAt", "endsAt");
CREATE INDEX "FieldMemberUnavailability_actorId_createdAt_idx" ON "FieldMemberUnavailability"("actorId", "createdAt");
CREATE UNIQUE INDEX "FieldShiftSpecialtyRequirement_shiftId_specialtyId_key" ON "FieldShiftSpecialtyRequirement"("shiftId", "specialtyId");
CREATE INDEX "FieldShiftSpecialtyRequirement_specialtyId_idx" ON "FieldShiftSpecialtyRequirement"("specialtyId");
CREATE INDEX "FieldShiftTemplate_teamId_active_name_idx" ON "FieldShiftTemplate"("teamId", "active", "name");
CREATE INDEX "FieldShiftTemplate_electoralZoneId_idx" ON "FieldShiftTemplate"("electoralZoneId");
CREATE INDEX "FieldShiftTemplate_pollingPlaceId_idx" ON "FieldShiftTemplate"("pollingPlaceId");
CREATE UNIQUE INDEX "FieldShiftTemplateSpecialtyRequirement_templateId_specialtyId_key" ON "FieldShiftTemplateSpecialtyRequirement"("templateId", "specialtyId");
CREATE INDEX "FieldShiftTemplateSpecialtyRequirement_specialtyId_idx" ON "FieldShiftTemplateSpecialtyRequirement"("specialtyId");

ALTER TABLE "FieldMemberUnavailability" ADD CONSTRAINT "FieldMemberUnavailability_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FieldMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldMemberUnavailability" ADD CONSTRAINT "FieldMemberUnavailability_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldShiftSpecialtyRequirement" ADD CONSTRAINT "FieldShiftSpecialtyRequirement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "FieldShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShiftSpecialtyRequirement" ADD CONSTRAINT "FieldShiftSpecialtyRequirement_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "FieldSpecialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldShiftTemplate" ADD CONSTRAINT "FieldShiftTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FieldTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShiftTemplate" ADD CONSTRAINT "FieldShiftTemplate_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldShiftTemplate" ADD CONSTRAINT "FieldShiftTemplate_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldShiftTemplateSpecialtyRequirement" ADD CONSTRAINT "FieldShiftTemplateSpecialtyRequirement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FieldShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldShiftTemplateSpecialtyRequirement" ADD CONSTRAINT "FieldShiftTemplateSpecialtyRequirement_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "FieldSpecialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
