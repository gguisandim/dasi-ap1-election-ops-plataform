import { Module } from "@nestjs/common";
import { OperationalMapController } from "./operational-map.controller";
import { OperationalMapService } from "./operational-map.service";

@Module({ controllers: [OperationalMapController], providers: [OperationalMapService], exports: [OperationalMapService] })
export class OperationalMapModule {}
