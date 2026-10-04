import { Module } from "@nestjs/common";
import { EventBusModule } from "@eops/event-bus";
import { PreparationChecklistsController } from "./preparation-checklists.controller";
import { PreparationChecklistsService } from "./preparation-checklists.service";

@Module({
  imports: [EventBusModule],
  controllers: [PreparationChecklistsController],
  providers: [PreparationChecklistsService],
  exports: [PreparationChecklistsService],
})
export class PreparationChecklistsModule {}
