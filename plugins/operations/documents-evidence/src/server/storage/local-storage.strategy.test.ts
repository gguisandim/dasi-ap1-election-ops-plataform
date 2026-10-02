import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageStrategy } from "./local-storage.strategy";

let root: string;
let storage: LocalStorageStrategy;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "eops-evidence-"));
  storage = new LocalStorageStrategy(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("driver de armazenamento local", () => {
  it("grava fora do banco e devolve chave, tamanho e checksum", async () => {
    const data = Buffer.from("conteudo da evidencia");
    const stored = await storage.store({
      originalName: "Comprovante Assinado.PDF",
      mimeType: "application/pdf",
      data,
      directory: "2026/10",
    });

    expect(stored.driver).toBe("local");
    expect(stored.size).toBe(data.byteLength);
    expect(stored.extension).toBe("pdf");
    expect(stored.originalName).toBe("Comprovante Assinado.PDF");
    expect(stored.checksum).toBe(createHash("sha256").update(data).digest("hex"));
    expect(stored.key.startsWith("2026/10/")).toBe(true);

    const onDisk = await readFile(path.join(root, stored.key));
    expect(onDisk.equals(data)).toBe(true);
  });

  it("recupera exatamente o conteúdo gravado", async () => {
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const stored = await storage.store({
      originalName: "captura.png",
      mimeType: "image/png",
      data,
    });

    const read = await storage.read(stored.key);
    expect(read.equals(data)).toBe(true);
    expect(createHash("sha256").update(read).digest("hex")).toBe(stored.checksum);
  });

  it("confirma existência e ausência de objetos", async () => {
    const stored = await storage.store({
      originalName: "log.txt",
      mimeType: "text/plain",
      data: Buffer.from("linha"),
    });
    expect(await storage.exists(stored.key)).toBe(true);
    expect(await storage.exists("2026/10/inexistente.txt")).toBe(false);
  });

  it("grava objetos distintos para o mesmo nome original", async () => {
    const first = await storage.store({
      originalName: "foto.jpg",
      mimeType: "image/jpeg",
      data: Buffer.from("primeira"),
    });
    const second = await storage.store({
      originalName: "foto.jpg",
      mimeType: "image/jpeg",
      data: Buffer.from("segunda"),
    });
    expect(first.key).not.toBe(second.key);
    expect((await storage.read(first.key)).toString()).toBe("primeira");
    expect((await storage.read(second.key)).toString()).toBe("segunda");
  });

  it("recusa leitura de chave que escapa da raiz", async () => {
    await expect(storage.read("../../etc/passwd")).rejects.toThrow(
      "Chave de armazenamento inválida",
    );
  });

  it("sinaliza conteúdo ausente em vez de devolver vazio", async () => {
    await expect(storage.read("2026/10/nao-existe.bin")).rejects.toThrow(
      "Arquivo não encontrado no armazenamento local",
    );
  });

  it("remove o objeto sem lançar erro quando ele já não existe", async () => {
    const stored = await storage.store({
      originalName: "temporario.txt",
      mimeType: "text/plain",
      data: Buffer.from("x"),
    });
    await storage.remove(stored.key);
    expect(await storage.exists(stored.key)).toBe(false);
    await expect(storage.remove(stored.key)).resolves.toBeUndefined();
  });
});
