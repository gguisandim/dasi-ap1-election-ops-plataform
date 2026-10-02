import { Injectable, NotImplementedException } from "@nestjs/common";
import { LocalStorageStrategy } from "./local-storage.strategy";
import type { StorageStrategy, StoreFileInput, StoredFile } from "./storage.types";

/** Drivers previstos. Apenas `local` está implementado nesta fase. */
export const KNOWN_STORAGE_DRIVERS = ["local", "supabase", "s3"] as const;
export type StorageDriver = (typeof KNOWN_STORAGE_DRIVERS)[number];

/**
 * Ponto único de acesso ao armazenamento.
 *
 * O domínio nunca fala com um driver diretamente: pede ao serviço, que resolve
 * o driver a partir de `EVIDENCE_STORAGE_DRIVER`. Um driver previsto mas ainda
 * não implementado falha com mensagem explícita — nunca grava em lugar errado
 * por omissão.
 */
@Injectable()
export class StorageService {
  private readonly strategy: StorageStrategy;

  constructor(driver: string = process.env.EVIDENCE_STORAGE_DRIVER ?? "local") {
    this.strategy = this.resolve(driver);
  }

  get driver(): string {
    return this.strategy.driver;
  }

  private resolve(driver: string): StorageStrategy {
    if (driver === "local") return new LocalStorageStrategy();
    if ((KNOWN_STORAGE_DRIVERS as readonly string[]).includes(driver)) {
      throw new NotImplementedException(
        `O driver de armazenamento "${driver}" ainda não está implementado. Use EVIDENCE_STORAGE_DRIVER=local.`,
      );
    }
    throw new NotImplementedException(
      `Driver de armazenamento desconhecido: "${driver}". Drivers previstos: ${KNOWN_STORAGE_DRIVERS.join(", ")}.`,
    );
  }

  store(input: StoreFileInput): Promise<StoredFile> {
    return this.strategy.store(input);
  }

  read(key: string): Promise<Buffer> {
    return this.strategy.read(key);
  }

  exists(key: string): Promise<boolean> {
    return this.strategy.exists(key);
  }

  remove(key: string): Promise<void> {
    return this.strategy.remove(key);
  }
}
