import { Module } from "@nestjs/common";
import { ResourceRequestsController } from "./resource-requests.controller";
import { ResourceRequestsService } from "./resource-requests.service";

@Module({
  controllers: [ResourceRequestsController],
  providers: [ResourceRequestsService],
})
export class ResourceRequestsModule {}
