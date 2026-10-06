import { Module } from "@nestjs/common";
import { CommandCenterController } from "./command-center.controller";
import { CommandCenterService } from "./command-center.service";
import { CommandCenterSnapshotsService } from "./command-center-snapshots.service";
import { CommandCenterViewsService } from "./command-center-views.service";

@Module({
  controllers: [CommandCenterController],
  providers: [
    CommandCenterService,
    CommandCenterViewsService,
    CommandCenterSnapshotsService,
  ],
})
export class CommandCenterModule {}
