import { Module } from "@nestjs/common";
import { CommunicationMetricsService } from "./communication-metrics.service";
import { CommunicationRecipientsService } from "./communication-recipients.service";
import { CommunicationTemplatesService } from "./communication-templates.service";
import { CommunicationTimelineService } from "./communication-timeline.service";
import { CommunicationsController } from "./communications.controller";
import { CommunicationsService } from "./communications.service";

@Module({
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    CommunicationRecipientsService,
    CommunicationMetricsService,
    CommunicationTemplatesService,
    CommunicationTimelineService,
  ],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
