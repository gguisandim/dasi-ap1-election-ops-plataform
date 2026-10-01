import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  AddEvidenceVersionDto,
  CreateEvidenceDto,
  CreateEvidenceTagDto,
  EvidenceQueryDto,
  ReplaceEvidenceLinksDto,
  UpdateEvidenceDto,
} from "./dto/evidence.dto";
import { EvidenceService, MAX_UPLOAD_BYTES } from "./evidence.service";
import { EvidenceTagsService } from "./evidence-tags.service";
import { EvidenceVersionsService } from "./evidence-versions.service";
import type { UploadedFile as UploadedFileContract } from "./types";

@Permissions(PERMISSIONS.evidence.read)
@Controller("evidence")
export class EvidenceController {
  constructor(
    private readonly service: EvidenceService,
    private readonly versions: EvidenceVersionsService,
    private readonly tags: EvidenceTagsService,
  ) {}

  // ------------------------------------------------------------------ leitura

  @Get()
  findAll(@Query() query: EvidenceQueryDto) {
    return this.service.findAll(query);
  }

  @Get("dashboard")
  dashboard(@Query("electionId") electionId?: string) {
    return this.service.dashboard(electionId);
  }

  @Get("gallery")
  gallery(@Query() query: EvidenceQueryDto) {
    return this.service.gallery(query);
  }

  @Get("reference-data")
  referenceData() {
    return this.service.referenceData();
  }

  @Get("tags")
  listTags() {
    return this.tags.list();
  }

  @Permissions(PERMISSIONS.evidence.manage)
  @Post("tags")
  createTag(@Body() dto: CreateEvidenceTagDto) {
    return this.tags.create(dto.label);
  }

  // ------------------------------------------------------------- registros

  /**
   * Registra uma evidência com o arquivo em `multipart/form-data`.
   * O arquivo é obrigatório: uma evidência sem conteúdo não comprova nada.
   */
  @Permissions(PERMISSIONS.evidence.upload)
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  create(
    @Body() dto: CreateEvidenceDto,
    @UploadedFile() file: UploadedFileContract | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto, file, {
      id: request.user.id,
      email: request.user.email,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Get(":id/timeline")
  timeline(@Param("id") id: string) {
    return this.service.timelineFor(id);
  }

  /** Compara o registro com o storage: aponta versões cujo objeto sumiu. */
  @Get(":id/integrity")
  integrity(@Param("id") id: string) {
    return this.service.integrityFor(id);
  }

  @Get(":id/versions")
  listVersions(@Param("id") id: string) {
    return this.versions.list(id);
  }

  // ------------------------------------------------------------ downloads

  @Get(":id/file")
  async downloadCurrent(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.stream(
      response,
      await this.versions.download(id, undefined, {
        id: request.user.id,
        name: request.user.email,
      }),
    );
  }

  @Get(":id/versions/:versionId/download")
  async downloadVersion(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.stream(
      response,
      await this.versions.download(id, versionId, {
        id: request.user.id,
        name: request.user.email,
      }),
    );
  }

  private stream(
    response: Response,
    payload: {
      version: { fileName: string; mimeType: string; size: number; checksum: string };
      buffer: Buffer;
    },
  ): StreamableFile {
    response.set({
      "Content-Type": payload.version.mimeType,
      "Content-Length": String(payload.buffer.byteLength),
      "Content-Disposition": `inline; filename="${encodeURIComponent(payload.version.fileName)}"`,
      // Permite ao cliente conferir a integridade do que recebeu.
      "X-Evidence-Checksum": payload.version.checksum,
    });
    return new StreamableFile(payload.buffer);
  }

  /** Nova versão exige motivo: a substituição nunca é silenciosa. */
  @Permissions(PERMISSIONS.evidence.version)
  @Post(":id/versions")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  addVersion(
    @Param("id") id: string,
    @Body() dto: AddEvidenceVersionDto,
    @UploadedFile() file: UploadedFileContract | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.addVersion(id, file, dto, {
      id: request.user.id,
      email: request.user.email,
    });
  }

  // ------------------------------------------------------------- escrita

  @Permissions(PERMISSIONS.evidence.manage)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateEvidenceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.evidence.manage)
  @Put(":id/links")
  replaceLinks(
    @Param("id") id: string,
    @Body() dto: ReplaceEvidenceLinksDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.replaceLinks(id, dto, {
      id: request.user.id,
      email: request.user.email,
    });
  }

  @Permissions(PERMISSIONS.evidence.manage)
  @Post(":id/archive")
  archive(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.archive(id, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.evidence.manage)
  @Post(":id/restore")
  restore(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.restore(id, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.evidence.manage)
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
