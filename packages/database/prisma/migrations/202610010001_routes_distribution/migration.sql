CREATE TYPE "RouteStatus" AS ENUM ('PLANNED', 'READY', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RouteStopStatus" AS ENUM ('PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED');
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'UNAVAILABLE');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED');
CREATE TYPE "LogisticsEventType" AS ENUM ('ROUTE_CREATED', 'ROUTE_STARTED', 'ROUTE_ARRIVED', 'DELIVERY_COMPLETED', 'DELIVERY_FAILED', 'DELAY_DETECTED', 'ROUTE_CANCELLED', 'ITEMS_COLLECTED', 'NOTE_ADDED');

CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL,
  "identification" TEXT NOT NULL,
  "plate" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "capacity" INTEGER,
  "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
  "driverName" TEXT,
  "responsibleName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributionRoute" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "electoralZoneId" TEXT NOT NULL,
  "description" TEXT,
  "originName" TEXT NOT NULL,
  "originLatitude" DECIMAL(9,6),
  "originLongitude" DECIMAL(9,6),
  "destinationName" TEXT NOT NULL,
  "destinationLatitude" DECIMAL(9,6),
  "destinationLongitude" DECIMAL(9,6),
  "plannedDeparture" TIMESTAMP(3) NOT NULL,
  "plannedArrival" TIMESTAMP(3) NOT NULL,
  "actualDeparture" TIMESTAMP(3),
  "actualArrival" TIMESTAMP(3),
  "responsibleName" TEXT NOT NULL,
  "driverName" TEXT,
  "vehicleId" TEXT,
  "notes" TEXT,
  "status" "RouteStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DistributionRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteStop" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "pollingPlaceId" TEXT,
  "order" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "eta" TIMESTAMP(3) NOT NULL,
  "actualAt" TIMESTAMP(3),
  "status" "RouteStopStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryBatch" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Delivery" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "batchId" TEXT,
  "pollingPlaceId" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "receiverName" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "notes" TEXT,
  "proofUrl" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryItem" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "assetId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "lotCode" TEXT,
  CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RouteHistoryEvent" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "type" "LogisticsEventType" NOT NULL,
  "message" TEXT NOT NULL,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RouteHistoryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vehicle_identification_key" ON "Vehicle"("identification");
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");
CREATE UNIQUE INDEX "DistributionRoute_code_key" ON "DistributionRoute"("code");
CREATE INDEX "DistributionRoute_electionId_status_idx" ON "DistributionRoute"("electionId", "status");
CREATE INDEX "DistributionRoute_electoralZoneId_status_idx" ON "DistributionRoute"("electoralZoneId", "status");
CREATE INDEX "DistributionRoute_responsibleName_idx" ON "DistributionRoute"("responsibleName");
CREATE INDEX "DistributionRoute_plannedDeparture_idx" ON "DistributionRoute"("plannedDeparture");
CREATE UNIQUE INDEX "RouteStop_routeId_order_key" ON "RouteStop"("routeId", "order");
CREATE INDEX "RouteStop_eta_status_idx" ON "RouteStop"("eta", "status");
CREATE UNIQUE INDEX "DeliveryBatch_code_key" ON "DeliveryBatch"("code");
CREATE INDEX "DeliveryBatch_routeId_idx" ON "DeliveryBatch"("routeId");
CREATE INDEX "Delivery_routeId_status_idx" ON "Delivery"("routeId", "status");
CREATE INDEX "Delivery_pollingPlaceId_status_idx" ON "Delivery"("pollingPlaceId", "status");
CREATE INDEX "Delivery_batchId_idx" ON "Delivery"("batchId");
CREATE INDEX "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId");
CREATE INDEX "DeliveryItem_assetId_idx" ON "DeliveryItem"("assetId");
CREATE INDEX "RouteHistoryEvent_routeId_createdAt_idx" ON "RouteHistoryEvent"("routeId", "createdAt");

ALTER TABLE "DistributionRoute" ADD CONSTRAINT "DistributionRoute_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributionRoute" ADD CONSTRAINT "DistributionRoute_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DistributionRoute" ADD CONSTRAINT "DistributionRoute_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DistributionRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DistributionRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DistributionRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DeliveryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteHistoryEvent" ADD CONSTRAINT "RouteHistoryEvent_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DistributionRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
