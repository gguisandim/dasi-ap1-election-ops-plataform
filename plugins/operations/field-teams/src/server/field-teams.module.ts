import { Module } from "@nestjs/common";
import { FieldDispatchService } from "./field-dispatch.service";
import { FieldTeamsController } from "./field-teams.controller";
import { FieldTeamsService } from "./field-teams.service";

@Module({
  controllers: [FieldTeamsController],
  providers: [FieldTeamsService, FieldDispatchService],
  exports: [FieldTeamsService, FieldDispatchService],
})
export class FieldTeamsModule {}
