import { Module } from "@nestjs/common";
import { ElectoralZonesController } from "./electoral-zones.controller";
import { ElectoralZonesService } from "./electoral-zones.service";

@Module({
  controllers: [ElectoralZonesController],
  providers: [ElectoralZonesService],
})
export class ElectoralZonesModule {}
