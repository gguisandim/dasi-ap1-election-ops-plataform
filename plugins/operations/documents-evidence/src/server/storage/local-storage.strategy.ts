import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  extensionOf,
  safeOriginalName,
  sha256,
  storageDirectory,
  storageFileName,
} from "../helpers/file-metadata";
import type { StorageStrategy, StoreFileInput, StoredFile } from "./storage.types";

const DRIVER = "local";

/**
 * Driver de desenvolvimento: grava os arquivos em disco, fora do PostgreSQL.
 *
 * A raiz vem de `EVIDENCE_STORAGE_ROOT` (padrão `storage/evidence` na raiz do
 * monorepo). Nenhum byte do arquivo é persistido no banco — apenas a chave.
 */
@Injectable()
export class LocalStorageStrategy implements StorageStrategy {
  readonly driver = DRIVER;
  private readonly logger = new Logger(LocalStorageStrategy.name);
  private readonly root: string;

  constructor(root = process.env.EVIDENCE_STORAGE_ROOT ?? "storage/evidence") {
    this.root = path.resolve(root);
  }

  /** Caminho absoluto da chave, recusando qualquer tentativa de escapar da raiz. */
  private resolveKey(key: string): string {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new BadRequestException("Chave de armazenamento inválida.");
    }
    return target;
  }

  async store(input: StoreFileInput): Promise<StoredFile> {
    const originalName = safeOriginalName(input.originalName);
    const directory = input.directory ?? storageDirectory();
    const key = `${directory}/${storageFileName(originalName)}`;
    const target = this.resolveKey(key);

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.data);

    return {
      key,
      driver: DRIVER,
      size: input.data.byteLength,
      checksum: sha256(input.data),
      mimeType: input.mimeType,
      originalName,
      extension: extensionOf(originalName),
    };
  }

  async read(key: string): Promise<Buffer> {
    // A validação de contenção roda fora do `try`: uma chave que escapa da raiz
    // precisa continuar sendo reportada como chave inválida, e não como arquivo
    // ausente — mascarar isso esconderia uma tentativa de acesso indevido.
    const target = this.resolveKey(key);
    try {
      return await fs.readFile(target);
    } catch {
      // O arquivo pode ter sido removido fora da plataforma; o erro precisa ser
      // explícito para que o domínio reporte a inconsistência.
      throw new BadRequestException(
        "Arquivo não encontrado no armazenamento local. A versão existe, mas o conteúdo não está disponível.",
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    const target = this.resolveKey(key);
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await fs.unlink(target);
    } catch {
      this.logger.warn(`Objeto já ausente no armazenamento local: ${key}`);
    }
  }
}
