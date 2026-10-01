import type { EvidenceLinkType } from "@prisma/client";

/**
 * Arquivo recebido pelo `FileInterceptor`.
 *
 * Declarado estruturalmente em vez de usar `Express.Multer.File` para não exigir
 * `@types/multer`: o plugin depende apenas dos campos que realmente consome.
 */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Ator que executa uma ação sobre a evidência. */
export interface EvidenceActor {
  id?: string;
  name?: string;
}

/** Vínculo já resolvido contra o banco central. */
export interface ResolvedLink {
  type: EvidenceLinkType;
  targetId: string;
  targetLabel: string;
  notes?: string;
}
