import { Module } from "@nestjs/common";
import { EventBusModule } from "../../../../../packages/event-bus/src";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [EventBusModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}