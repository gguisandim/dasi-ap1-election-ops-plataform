-- CreateEnum
CREATE TYPE "CommandCenterHealth" AS ENUM ('NORMAL', 'ATTENTION', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CommandCenterLayoutMode" AS ENUM ('STANDARD', 'WALLBOARD');

-- CreateEnum
CREATE TYPE "ResourceRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'TRIAGED', 'APPROVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResourceRequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ResourceRequestItemKind" AS ENUM ('ASSET', 'ASSET_TYPE', 'FIELD_TEAM', 'VEHICLE', 'TRANSPORT', 'TECH_SUPPORT', 'MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ResourceRequestHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'TRIAGED', 'OWNER_CHANGED', 'PRIORITY_CHANGED', 'APPROVED', 'REJECTED', 'FULFILLMENT_ADDED', 'FULFILLMENT_REMOVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'COMMENT_ADDED');

-- CreateEnum
CREATE TYPE "PostmortemStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PostmortemCauseType" AS ENUM ('ROOT_CAUSE', 'CONTRIBUTING_FACTOR', 'CONDITION');

-- CreateEnum
CREATE TYPE "PostmortemCauseCategory" AS ENUM ('PEOPLE', 'PROCESS', 'TECHNOLOGY', 'COMMUNICATION', 'LOGISTICS', 'EXTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PostmortemLessonType" AS ENUM ('WENT_WELL', 'WENT_WRONG', 'LESSON', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "PostmortemActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PostmortemReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "PostmortemTimelineSource" AS ENUM ('INCIDENT_EVENT', 'SHIFT_HANDOVER', 'TASK', 'RESOURCE_REQUEST', 'MANUAL');

-- CreateTable
CREATE TABLE "CommandCenterSavedView" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "layoutMode" "CommandCenterLayoutMode" NOT NULL DEFAULT 'STANDARD',
    "refreshSeconds" INTEGER NOT NULL DEFAULT 45,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandCenterSavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandCenterSnapshot" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "electionId" TEXT,
    "electoralZoneId" TEXT,
    "health" "CommandCenterHealth" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandCenterSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "electoralZoneId" TEXT,
    "pollingPlaceId" TEXT,
    "incidentId" TEXT,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "ResourceRequestPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ResourceRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT NOT NULL,
    "ownerId" TEXT,
    "neededAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "triagedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "triageNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" "ResourceRequestItemKind" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "assetTypeId" TEXT,
    "fieldTeamId" TEXT,
    "vehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequestFulfillment" (
    "id" TEXT NOT NULL,
    "requestItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fulfilledById" TEXT NOT NULL,
    "assetId" TEXT,
    "assetReservationId" TEXT,
    "fieldTeamId" TEXT,
    "vehicleId" TEXT,
    "routeId" TEXT,
    "taskId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceRequestFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequestHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "ResourceRequestHistoryAction" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceRequestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Postmortem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "primaryIncidentId" TEXT NOT NULL,
    "status" "PostmortemStatus" NOT NULL DEFAULT 'DRAFT',
    "executiveSummary" TEXT,
    "impactSummary" TEXT,
    "detectionSummary" TEXT,
    "responseSummary" TEXT,
    "resolutionSummary" TEXT,
    "rootCauseSummary" TEXT,
    "lessonsSummary" TEXT,
    "createdById" TEXT NOT NULL,
    "ownerId" TEXT,
    "submittedForReviewAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Postmortem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmortemRelatedIncident" (
    "id" TEXT NOT NULL,
    "postmortemId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostmortemRelatedIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmortemTimelineEntry" (
    "id" TEXT NOT NULL,
    "postmortemId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sourceType" "PostmortemTimelineSource" NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostmortemTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmortemCause" (
    "id" TEXT NOT NULL,
    "postmortemId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "PostmortemCauseType" NOT NULL,
    "category" "PostmortemCauseCategory" NOT NULL,
    "statement" TEXT NOT NULL,
    "evidence" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostmortemCause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmortemLesson" (
    "id" TEXT NOT NULL,
    "postmortemId" TEXT NOT NULL,
    "type" "PostmortemLessonType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "PostmortemCauseCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostmortemLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmortemActionItem" (
    "id" TEXT NOT NULL,
    "postmortemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "ownerUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "PostmortemActionStatus" NOT NULL DEFAULT 'OPEN',
    "taskId" TEXT,
    "createdById" TEXT,
    "overdueNotifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostmortemActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmortemReviewer" (
    "id" TEXT NOT NULL,
    "postmortemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostmortemReviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmortemReview" (
    "id" TEXT NOT NULL,
    "postmortemId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "PostmortemReviewDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostmortemReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommandCenterSavedView_ownerId_isDefault_idx" ON "CommandCenterSavedView"("ownerId", "isDefault");

-- CreateIndex
CREATE INDEX "CommandCenterSavedView_shared_updatedAt_idx" ON "CommandCenterSavedView"("shared", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommandCenterSavedView_ownerId_name_key" ON "CommandCenterSavedView"("ownerId", "name");

-- CreateIndex
CREATE INDEX "CommandCenterSnapshot_electionId_createdAt_idx" ON "CommandCenterSnapshot"("electionId", "createdAt");

-- CreateIndex
CREATE INDEX "CommandCenterSnapshot_createdAt_idx" ON "CommandCenterSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRequest_code_key" ON "ResourceRequest"("code");

-- CreateIndex
CREATE INDEX "ResourceRequest_status_priority_idx" ON "ResourceRequest"("status", "priority");

-- CreateIndex
CREATE INDEX "ResourceRequest_electionId_status_idx" ON "ResourceRequest"("electionId", "status");

-- CreateIndex
CREATE INDEX "ResourceRequest_neededAt_status_idx" ON "ResourceRequest"("neededAt", "status");

-- CreateIndex
CREATE INDEX "ResourceRequest_ownerId_status_idx" ON "ResourceRequest"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ResourceRequest_requestedById_status_idx" ON "ResourceRequest"("requestedById", "status");

-- CreateIndex
CREATE INDEX "ResourceRequest_incidentId_idx" ON "ResourceRequest"("incidentId");

-- CreateIndex
CREATE INDEX "ResourceRequest_taskId_idx" ON "ResourceRequest"("taskId");

-- CreateIndex
CREATE INDEX "ResourceRequest_electoralZoneId_status_idx" ON "ResourceRequest"("electoralZoneId", "status");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_requestId_kind_idx" ON "ResourceRequestItem"("requestId", "kind");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_assetTypeId_idx" ON "ResourceRequestItem"("assetTypeId");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_fieldTeamId_idx" ON "ResourceRequestItem"("fieldTeamId");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_vehicleId_idx" ON "ResourceRequestItem"("vehicleId");

-- CreateIndex
CREATE INDEX "ResourceRequestFulfillment_requestItemId_createdAt_idx" ON "ResourceRequestFulfillment"("requestItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceRequestFulfillment_assetId_idx" ON "ResourceRequestFulfillment"("assetId");

-- CreateIndex
CREATE INDEX "ResourceRequestFulfillment_assetReservationId_idx" ON "ResourceRequestFulfillment"("assetReservationId");

-- CreateIndex
CREATE INDEX "ResourceRequestFulfillment_fieldTeamId_idx" ON "ResourceRequestFulfillment"("fieldTeamId");

-- CreateIndex
CREATE INDEX "ResourceRequestFulfillment_vehicleId_idx" ON "ResourceRequestFulfillment"("vehicleId");

-- CreateIndex
CREATE INDEX "ResourceRequestFulfillment_routeId_idx" ON "ResourceRequestFulfillment"("routeId");

-- CreateIndex
CREATE INDEX "ResourceRequestFulfillment_taskId_idx" ON "ResourceRequestFulfillment"("taskId");

-- CreateIndex
CREATE INDEX "ResourceRequestFulfillment_fulfilledById_createdAt_idx" ON "ResourceRequestFulfillment"("fulfilledById", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceRequestHistory_requestId_createdAt_idx" ON "ResourceRequestHistory"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceRequestHistory_actorId_createdAt_idx" ON "ResourceRequestHistory"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceRequestComment_requestId_createdAt_idx" ON "ResourceRequestComment"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceRequestComment_authorId_createdAt_idx" ON "ResourceRequestComment"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Postmortem_code_key" ON "Postmortem"("code");

-- CreateIndex
CREATE INDEX "Postmortem_status_createdAt_idx" ON "Postmortem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Postmortem_primaryIncidentId_idx" ON "Postmortem"("primaryIncidentId");

-- CreateIndex
CREATE INDEX "Postmortem_ownerId_status_idx" ON "Postmortem"("ownerId", "status");

-- CreateIndex
CREATE INDEX "PostmortemRelatedIncident_incidentId_idx" ON "PostmortemRelatedIncident"("incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "PostmortemRelatedIncident_postmortemId_incidentId_key" ON "PostmortemRelatedIncident"("postmortemId", "incidentId");

-- CreateIndex
CREATE INDEX "PostmortemTimelineEntry_postmortemId_occurredAt_idx" ON "PostmortemTimelineEntry"("postmortemId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostmortemTimelineEntry_postmortemId_sourceType_sourceId_key" ON "PostmortemTimelineEntry"("postmortemId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "PostmortemCause_postmortemId_type_idx" ON "PostmortemCause"("postmortemId", "type");

-- CreateIndex
CREATE INDEX "PostmortemCause_parentId_idx" ON "PostmortemCause"("parentId");

-- CreateIndex
CREATE INDEX "PostmortemLesson_postmortemId_type_idx" ON "PostmortemLesson"("postmortemId", "type");

-- CreateIndex
CREATE INDEX "PostmortemActionItem_postmortemId_status_idx" ON "PostmortemActionItem"("postmortemId", "status");

-- CreateIndex
CREATE INDEX "PostmortemActionItem_status_dueAt_idx" ON "PostmortemActionItem"("status", "dueAt");

-- CreateIndex
CREATE INDEX "PostmortemActionItem_ownerUserId_status_idx" ON "PostmortemActionItem"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "PostmortemActionItem_taskId_idx" ON "PostmortemActionItem"("taskId");

-- CreateIndex
CREATE INDEX "PostmortemReviewer_userId_idx" ON "PostmortemReviewer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostmortemReviewer_postmortemId_userId_key" ON "PostmortemReviewer"("postmortemId", "userId");

-- CreateIndex
CREATE INDEX "PostmortemReview_postmortemId_createdAt_idx" ON "PostmortemReview"("postmortemId", "createdAt");

-- CreateIndex
CREATE INDEX "PostmortemReview_reviewerId_createdAt_idx" ON "PostmortemReview"("reviewerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommandCenterSavedView" ADD CONSTRAINT "CommandCenterSavedView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandCenterSnapshot" ADD CONSTRAINT "CommandCenterSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandCenterSnapshot" ADD CONSTRAINT "CommandCenterSnapshot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandCenterSnapshot" ADD CONSTRAINT "CommandCenterSnapshot_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestItem" ADD CONSTRAINT "ResourceRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ResourceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestItem" ADD CONSTRAINT "ResourceRequestItem_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "AssetType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestItem" ADD CONSTRAINT "ResourceRequestItem_fieldTeamId_fkey" FOREIGN KEY ("fieldTeamId") REFERENCES "FieldTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestItem" ADD CONSTRAINT "ResourceRequestItem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestFulfillment" ADD CONSTRAINT "ResourceRequestFulfillment_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "ResourceRequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestFulfillment" ADD CONSTRAINT "ResourceRequestFulfillment_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestFulfillment" ADD CONSTRAINT "ResourceRequestFulfillment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestFulfillment" ADD CONSTRAINT "ResourceRequestFulfillment_assetReservationId_fkey" FOREIGN KEY ("assetReservationId") REFERENCES "AssetReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestFulfillment" ADD CONSTRAINT "ResourceRequestFulfillment_fieldTeamId_fkey" FOREIGN KEY ("fieldTeamId") REFERENCES "FieldTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestFulfillment" ADD CONSTRAINT "ResourceRequestFulfillment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestFulfillment" ADD CONSTRAINT "ResourceRequestFulfillment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DistributionRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestFulfillment" ADD CONSTRAINT "ResourceRequestFulfillment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestHistory" ADD CONSTRAINT "ResourceRequestHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ResourceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestHistory" ADD CONSTRAINT "ResourceRequestHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestComment" ADD CONSTRAINT "ResourceRequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ResourceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequestComment" ADD CONSTRAINT "ResourceRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postmortem" ADD CONSTRAINT "Postmortem_primaryIncidentId_fkey" FOREIGN KEY ("primaryIncidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postmortem" ADD CONSTRAINT "Postmortem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postmortem" ADD CONSTRAINT "Postmortem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postmortem" ADD CONSTRAINT "Postmortem_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemRelatedIncident" ADD CONSTRAINT "PostmortemRelatedIncident_postmortemId_fkey" FOREIGN KEY ("postmortemId") REFERENCES "Postmortem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemRelatedIncident" ADD CONSTRAINT "PostmortemRelatedIncident_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemTimelineEntry" ADD CONSTRAINT "PostmortemTimelineEntry_postmortemId_fkey" FOREIGN KEY ("postmortemId") REFERENCES "Postmortem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemTimelineEntry" ADD CONSTRAINT "PostmortemTimelineEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemCause" ADD CONSTRAINT "PostmortemCause_postmortemId_fkey" FOREIGN KEY ("postmortemId") REFERENCES "Postmortem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemCause" ADD CONSTRAINT "PostmortemCause_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PostmortemCause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemLesson" ADD CONSTRAINT "PostmortemLesson_postmortemId_fkey" FOREIGN KEY ("postmortemId") REFERENCES "Postmortem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemActionItem" ADD CONSTRAINT "PostmortemActionItem_postmortemId_fkey" FOREIGN KEY ("postmortemId") REFERENCES "Postmortem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemActionItem" ADD CONSTRAINT "PostmortemActionItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemActionItem" ADD CONSTRAINT "PostmortemActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemActionItem" ADD CONSTRAINT "PostmortemActionItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemReviewer" ADD CONSTRAINT "PostmortemReviewer_postmortemId_fkey" FOREIGN KEY ("postmortemId") REFERENCES "Postmortem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemReviewer" ADD CONSTRAINT "PostmortemReviewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemReview" ADD CONSTRAINT "PostmortemReview_postmortemId_fkey" FOREIGN KEY ("postmortemId") REFERENCES "Postmortem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostmortemReview" ADD CONSTRAINT "PostmortemReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

