import { Module } from "@nestjs/common";
import { PollingSectionsController } from "./polling-sections.controller";
import { PollingSectionsService } from "./polling-sections.service";

@Module({
  controllers: [PollingSectionsController],
  providers: [PollingSectionsService],
})
export class PollingSectionsModule {}
