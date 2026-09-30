import { Module } from "@nestjs/common";
import { PollingPlacesController } from "./polling-places.controller";
import { PollingPlacesService } from "./polling-places.service";

@Module({
  controllers: [PollingPlacesController],
  providers: [PollingPlacesService],
})
export class PollingPlacesModule {}
