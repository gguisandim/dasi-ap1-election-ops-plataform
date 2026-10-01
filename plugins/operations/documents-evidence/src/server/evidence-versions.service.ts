import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EvidenceEventType, EvidenceStatus, EvidenceType } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { validateFileForType } from "./helpers/evidence-type";
import { storageDirectory } from "./helpers/file-metadata";
import { StorageService } from "./storage/storage.service";
import { EvidenceTimelineService } from "./evidence-timeline.service";
import type { EvidenceActor, UploadedFile } from "./types";

export interface StoredVersion {
  id: string;
  number: number;
  fileName: string;
  extension: string;
  mimeType: string;
  size: number;
  checksum: string;
  isCurrent: boolean;
}

/**
 * Versionamento de arquivos.
 *
 * Regra central do domínio: **nunca sobrescrever**. Uma nova versão recebe o
 * número seguinte, a anterior passa a `isCurrent = false` e continua acessível
 * pelo mesmo caminho de download. O objeto anterior permanece no storage.
 */
@Injectable()
export class EvidenceVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly timeline: EvidenceTimelineService,
  ) {}

  /** Driver de armazenamento ativo, exposto para diagnóstico e para a interface. */
  get driver(): string {
    return this.storage.driver;
  }

  private validate(file: UploadedFile | undefined, type: EvidenceType) {
    if (!file?.buffer) {
      throw new BadRequestException("Envie um arquivo para registrar a evidência.");
    }
    const error = validateFileForType(type, file.mimetype, file.size);
    if (error) throw new BadRequestException(error);
    return file;
  }

  /**
   * Grava o objeto no storage e cria a versão dentro de uma transação.
   *
   * Se a transação falhar, o objeto órfão é removido do storage — o banco nunca
   * aponta para um arquivo inexistente por causa de falha parcial.
   */
  private async storeVersion(
    evidenceId: string,
    file: UploadedFile,
    type: EvidenceType,
    actor: EvidenceActor | undefined,
    options: { reason?: string; description?: string; number: number },
  ) {
    const stored = await this.storage.store({
      originalName: file.originalname,
      mimeType: file.mimetype,
      data: file.buffer,
      directory: storageDirectory(),
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.evidenceVersion.updateMany({
          where: { evidenceId, isCurrent: true },
          data: { isCurrent: false },
        });
        const version = await tx.evidenceVersion.create({
          data: {
            evidenceId,
            number: options.number,
            fileName: stored.originalName,
            extension: stored.extension,
            mimeType: stored.mimeType,
            size: stored.size,
            checksum: stored.checksum,
            storageKey: stored.key,
            storageDriver: stored.driver,
            reason: options.reason,
            description: options.description,
            authorId: actor?.id,
            authorName: actor?.name ?? "Sistema",
            isCurrent: true,
          },
        });
        await tx.evidence.update({
          where: { id: evidenceId },
          data: {
            currentVersion: options.number,
            versionCount: { increment: 1 },
            // Uma evidência arquivada que recebe arquivo volta a ficar ativa.
            status: EvidenceStatus.ACTIVE,
            archivedAt: null,
          },
        });
        return version;
      });
    } catch (error) {
      await this.storage.remove(stored.key);
      throw error;
    }
  }

  /** Primeira versão, criada junto com a evidência. */
  async createInitialVersion(
    evidenceId: string,
    file: UploadedFile | undefined,
    type: EvidenceType,
    actor: EvidenceActor | undefined,
  ) {
    const validated = this.validate(file, type);
    return this.storeVersion(evidenceId, validated, type, actor, { number: 1 });
  }

  /** Versão adicional, exigindo justificativa. */
  async addVersion(
    evidenceId: string,
    file: UploadedFile | undefined,
    dto: { reason: string; description?: string },
    actor?: EvidenceActor,
  ) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, code: true, title: true, type: true, currentVersion: true },
    });
    if (!evidence) throw new NotFoundException("Evidência não encontrada.");

    const validated = this.validate(file, evidence.type);
    const number = evidence.currentVersion + 1;

    const version = await this.storeVersion(evidenceId, validated, evidence.type, actor, {
      number,
      reason: dto.reason,
      description: dto.description,
    });
    await this.timeline.record(evidenceId, {
      type: EvidenceEventType.VERSION_ADDED,
      message: `Versão ${number} adicionada: ${version.fileName}. Motivo: ${dto.reason}.`,
      actorId: actor?.id,
      actorName: actor?.name,
      metadata: { version: number, checksum: version.checksum, size: version.size },
    });
    return { version, evidence };
  }

  list(evidenceId: string) {
    return this.prisma.evidenceVersion.findMany({
      where: { evidenceId },
      orderBy: { number: "desc" },
    });
  }

  /** Versão pedida ou a versão corrente quando `versionId` não é informado. */
  async findVersion(evidenceId: string, versionId?: string) {
    const version = versionId
      ? await this.prisma.evidenceVersion.findUnique({ where: { id: versionId } })
      : await this.prisma.evidenceVersion.findFirst({
          where: { evidenceId, isCurrent: true },
        });
    if (!version || version.evidenceId !== evidenceId) {
      throw new NotFoundException("Versão não encontrada para esta evidência.");
    }
    return version;
  }

  /**
   * Lê o conteúdo do objeto e registra o download na timeline.
   * O registro torna reconstruível quem acessou cada arquivo e quando.
   */
  async download(
    evidenceId: string,
    versionId: string | undefined,
    actor?: EvidenceActor,
  ) {
    const version = await this.findVersion(evidenceId, versionId);
    const buffer = await this.storage.read(version.storageKey);
    await this.timeline.record(evidenceId, {
      type: EvidenceEventType.DOWNLOADED,
      message: `Arquivo da versão ${version.number} baixado (${version.fileName}).`,
      actorId: actor?.id,
      actorName: actor?.name,
      metadata: { version: version.number, checksum: version.checksum },
    });
    return { version, buffer };
  }

  /** Confere se o objeto ainda existe no driver — usado pelo endpoint de integridade. */
  async verifyIntegrity(evidenceId: string) {
    const versions = await this.list(evidenceId);
    const checks = await Promise.all(
      versions.map(async (version) => ({
        version: version.number,
        checksum: version.checksum,
        available: await this.storage.exists(version.storageKey),
      })),
    );
    return {
      total: versions.length,
      available: checks.filter((check) => check.available).length,
      missing: checks.filter((check) => !check.available).map((check) => check.version),
      versions: checks,
    };
  }
}
