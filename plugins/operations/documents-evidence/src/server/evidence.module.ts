import { Module } from "@nestjs/common";
import { EvidenceController } from "./evidence.controller";
import { EvidenceLinksService } from "./evidence-links.service";
import { EvidenceService } from "./evidence.service";
import { EvidenceTagsService } from "./evidence-tags.service";
import { EvidenceTimelineService } from "./evidence-timeline.service";
import { EvidenceVersionsService } from "./evidence-versions.service";
import { StorageService } from "./storage/storage.service";

@Module({
  controllers: [EvidenceController],
  providers: [
    EvidenceService,
    EvidenceVersionsService,
    EvidenceLinksService,
    EvidenceTagsService,
    EvidenceTimelineService,
    {
      provide: StorageService,
      // O driver é escolhido por configuração; a resolução falha de forma
      // explícita quando `EVIDENCE_STORAGE_DRIVER` aponta para algo não suportado.
      useFactory: () => new StorageService(),
    },
  ],
  exports: [EvidenceService],
})
export class DocumentsEvidenceModule {}
