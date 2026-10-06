-- CreateEnum
CREATE TYPE "AssetReservationStatus" AS ENUM ('REQUESTED', 'APPROVED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetAssignmentKind" AS ENUM ('ALLOCATION', 'CUSTODY');

-- CreateEnum
CREATE TYPE "AssetMaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "AssetMaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RouteExceptionReason" AS ENUM ('RECIPIENT_ABSENT', 'WRONG_ADDRESS', 'ACCESS_BLOCKED', 'VEHICLE_PROBLEM', 'ASSET_PROBLEM', 'DELIVERY_REFUSED', 'OTHER');

-- AlterEnum
ALTER TYPE "RouteStatus" ADD VALUE 'DISPATCHED' AFTER 'READY';

-- AlterEnum
ALTER TYPE "RouteStopStatus" ADD VALUE 'FAILED' AFTER 'COMPLETED';

-- AlterEnum
ALTER TYPE "LogisticsEventType" ADD VALUE 'ROUTE_READY' AFTER 'ROUTE_CREATED';
ALTER TYPE "LogisticsEventType" ADD VALUE 'ROUTE_DISPATCHED' AFTER 'ROUTE_READY';
ALTER TYPE "LogisticsEventType" ADD VALUE 'STOP_ARRIVED' AFTER 'ROUTE_ARRIVED';
ALTER TYPE "LogisticsEventType" ADD VALUE 'STOP_COMPLETED' AFTER 'STOP_ARRIVED';
ALTER TYPE "LogisticsEventType" ADD VALUE 'STOP_FAILED' AFTER 'STOP_COMPLETED';
ALTER TYPE "LogisticsEventType" ADD VALUE 'STOP_SKIPPED' AFTER 'STOP_FAILED';
ALTER TYPE "LogisticsEventType" ADD VALUE 'EXCEPTION_CREATED' AFTER 'DELIVERY_FAILED';
ALTER TYPE "LogisticsEventType" ADD VALUE 'EXCEPTION_RESOLVED' AFTER 'EXCEPTION_CREATED';
ALTER TYPE "LogisticsEventType" ADD VALUE 'STOPS_REORDERED' AFTER 'EXCEPTION_RESOLVED';

-- AlterTable
ALTER TABLE "AssetAssignment"
ADD COLUMN "kind" "AssetAssignmentKind" NOT NULL DEFAULT 'ALLOCATION',
ADD COLUMN "purpose" TEXT,
ADD COLUMN "originLabel" TEXT,
ADD COLUMN "destinationLabel" TEXT,
ADD COLUMN "expectedReturnAt" TIMESTAMP(3),
ADD COLUMN "conditionOut" "AssetCondition",
ADD COLUMN "conditionIn" "AssetCondition",
ADD COLUMN "returnedAt" TIMESTAMP(3),
ADD COLUMN "returnedTo" TEXT,
ADD COLUMN "receivedById" TEXT,
ADD COLUMN "receivedByName" TEXT,
ADD COLUMN "checkedOutById" TEXT,
ADD COLUMN "checkedInById" TEXT,
ADD COLUMN "checkoutNotes" TEXT,
ADD COLUMN "returnNotes" TEXT,
ADD COLUMN "problemDetected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "handledById" TEXT;

-- CreateTable
CREATE TABLE "AssetReservation" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "requesterId" TEXT,
  "requesterName" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "AssetReservationStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AssetReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaintenance" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "type" "AssetMaintenanceType" NOT NULL,
  "status" "AssetMaintenanceStatus" NOT NULL DEFAULT 'OPEN',
  "description" TEXT NOT NULL,
  "responsible" TEXT NOT NULL,
  "cost" DECIMAL(12,2),
  "result" TEXT,
  "notes" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "openedById" TEXT,
  "completedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteException" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "stopId" TEXT,
  "deliveryId" TEXT,
  "reason" "RouteExceptionReason" NOT NULL,
  "notes" TEXT,
  "actorId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RouteException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetAssignment_assetId_kind_endedAt_idx" ON "AssetAssignment"("assetId", "kind", "endedAt");
CREATE INDEX "AssetAssignment_expectedReturnAt_endedAt_idx" ON "AssetAssignment"("expectedReturnAt", "endedAt");
CREATE INDEX "AssetReservation_assetId_status_idx" ON "AssetReservation"("assetId", "status");
CREATE INDEX "AssetReservation_startsAt_endsAt_idx" ON "AssetReservation"("startsAt", "endsAt");
CREATE INDEX "AssetReservation_status_endsAt_idx" ON "AssetReservation"("status", "endsAt");
CREATE INDEX "AssetMaintenance_assetId_status_idx" ON "AssetMaintenance"("assetId", "status");
CREATE INDEX "AssetMaintenance_status_openedAt_idx" ON "AssetMaintenance"("status", "openedAt");
CREATE INDEX "RouteException_routeId_createdAt_idx" ON "RouteException"("routeId", "createdAt");
CREATE INDEX "RouteException_routeId_resolvedAt_idx" ON "RouteException"("routeId", "resolvedAt");
CREATE INDEX "RouteException_stopId_idx" ON "RouteException"("stopId");
CREATE INDEX "RouteException_deliveryId_idx" ON "RouteException"("deliveryId");

-- AddForeignKey
ALTER TABLE "AssetReservation" ADD CONSTRAINT "AssetReservation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteException" ADD CONSTRAINT "RouteException_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DistributionRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteException" ADD CONSTRAINT "RouteException_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "RouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteException" ADD CONSTRAINT "RouteException_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
