import { Module } from "@nestjs/common";
import { ShiftHandoversController } from "./shift-handovers.controller";
import { ShiftHandoversService } from "./shift-handovers.service";

@Module({
  controllers: [ShiftHandoversController],
  providers: [ShiftHandoversService],
})
export class ShiftHandoversModule {}
