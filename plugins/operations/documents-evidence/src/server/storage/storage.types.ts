/**
 * Contrato de armazenamento de arquivos.
 *
 * O banco guarda apenas metadados e a chave do objeto; o conteúdo binário vive
 * no driver. A implementação local atende o desenvolvimento; a interface existe
 * para que um driver de Supabase Storage ou S3 possa ser adicionado sem alterar
 * o domínio.
 */

/** Arquivo recebido pelo storage, já em memória. */
export interface StoreFileInput {
  /** Nome original enviado pelo cliente, preservado para exibição e download. */
  originalName: string;
  /** MIME declarado pelo cliente e validado pelo domínio. */
  mimeType: string;
  data: Buffer;
  /** Diretório lógico dentro do driver (ex.: `2026/10`). */
  directory?: string;
}

/** Resultado do armazenamento, pronto para virar `EvidenceVersion`. */
export interface StoredFile {
  key: string;
  driver: string;
  size: number;
  /** SHA-256 do conteúdo, em hexadecimal minúsculo. */
  checksum: string;
  mimeType: string;
  originalName: string;
  extension: string;
}

export interface StorageStrategy {
  readonly driver: string;
  /** Persiste o arquivo e devolve a chave sob a qual ele pode ser recuperado. */
  store(input: StoreFileInput): Promise<StoredFile>;
  /** Lê o conteúdo de uma chave previamente gravada. */
  read(key: string): Promise<Buffer>;
  /** Indica se a chave existe no driver. */
  exists(key: string): Promise<boolean>;
  /** Remove o objeto. Não é usado pelo domínio, que preserva versões. */
  remove(key: string): Promise<void>;
}
