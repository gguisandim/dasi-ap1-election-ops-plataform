import { Module } from "@nestjs/common";
import { KnowledgeCatalogService } from "./knowledge-catalog.service";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";
import { RunbookService } from "./runbook.service";

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, RunbookService, KnowledgeCatalogService],
  exports: [KnowledgeService, RunbookService],
})
export class KnowledgeRunbooksModule {}
