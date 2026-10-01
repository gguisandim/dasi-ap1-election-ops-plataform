import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extensionOf,
  formatBytes,
  safeOriginalName,
  sha256,
  shortChecksum,
  storageDirectory,
  storageFileName,
} from "./file-metadata";

describe("checksum", () => {
  it("reproduz o SHA-256 conhecido de um conteúdo", () => {
    const content = Buffer.from("comprovante de entrega");
    const expected = createHash("sha256").update(content).digest("hex");
    expect(sha256(content)).toBe(expected);
  });

  it("produz o mesmo valor para o mesmo conteúdo e outro para conteúdo diferente", () => {
    const first = Buffer.from("relatorio-a");
    const copy = Buffer.from("relatorio-a");
    const other = Buffer.from("relatorio-b");
    expect(sha256(first)).toBe(sha256(copy));
    expect(sha256(first)).not.toBe(sha256(other));
  });

  it("devolve hexadecimal de 64 caracteres", () => {
    expect(sha256(Buffer.from("x"))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("encurta o checksum para exibição", () => {
    expect(shortChecksum("abcdef0123456789")).toBe("abcdef012345");
  });
});

describe("nome e extensão do arquivo", () => {
  it("extrai a extensão em minúsculas", () => {
    expect(extensionOf("Relatorio.PDF")).toBe("pdf");
    expect(extensionOf("foto.jpeg")).toBe("jpeg");
  });

  it("devolve vazio quando não há extensão", () => {
    expect(extensionOf("arquivo")).toBe("");
  });

  it("remove diretórios e caracteres inseguros do nome original", () => {
    expect(safeOriginalName("C:\\temp\\foto<1>.png")).toBe("foto_1_.png");
    expect(safeOriginalName("../../etc/passwd")).toBe("passwd");
  });

  it("usa um nome padrão quando o resultado fica vazio", () => {
    expect(safeOriginalName("   ")).toBe("arquivo");
  });

  it("descarta caracteres de controle", () => {
    expect(safeOriginalName("nome\u0000com\u001fcontrole.png")).toBe("nomecomcontrole.png");
  });

  it("gera nome físico sem reutilizar o nome do usuário", () => {
    const generated = storageFileName("foto original.png");
    expect(generated).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(generated).not.toContain("foto");
  });

  it("gera nomes físicos distintos para o mesmo arquivo", () => {
    expect(storageFileName("a.png")).not.toBe(storageFileName("a.png"));
  });

  it("organiza o diretório por ano e mês", () => {
    expect(storageDirectory(new Date("2026-10-01T12:00:00.000Z"))).toBe("2026/10");
    expect(storageDirectory(new Date("2026-01-31T23:00:00.000Z"))).toBe("2026/01");
  });
});

describe("formatação de tamanho", () => {
  it("formata bytes, KB e MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 MB");
  });
});
