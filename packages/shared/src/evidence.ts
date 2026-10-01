/**
 * Contratos compartilhados do domínio de Documentos e Evidências.
 *
 * O plugin `@eops/plugin-documents-evidence` é o dono destes tipos. Outros
 * domínios consomem apenas estes contratos, nunca o service interno do plugin.
 */

export const EVIDENCE_TYPES = [
  "PHOTO",
  "DOCUMENT",
  "RECEIPT",
  "REPORT",
  "LOG",
  "SCREENSHOT",
  "OTHER",
] as const;
export const EVIDENCE_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export const EVIDENCE_LINK_TYPES = [
  "INCIDENT",
  "ASSET",
  "POLLING_PLACE",
  "ELECTORAL_ZONE",
  "ROUTE",
  "DELIVERY",
  "TRANSMISSION",
  "RISK",
  "COMMUNICATION",
  "FIELD_TEAM",
  "OTHER",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export type EvidenceLinkType = (typeof EVIDENCE_LINK_TYPES)[number];

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  PHOTO: "Fotografia",
  DOCUMENT: "Documento",
  RECEIPT: "Comprovante",
  REPORT: "Relatório",
  LOG: "Registro de log",
  SCREENSHOT: "Captura de tela",
  OTHER: "Outro",
};

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  ACTIVE: "Ativa",
  ARCHIVED: "Arquivada",
};

export const EVIDENCE_LINK_LABELS: Record<EvidenceLinkType, string> = {
  INCIDENT: "Incidente",
  ASSET: "Ativo",
  POLLING_PLACE: "Local de votação",
  ELECTORAL_ZONE: "Zona eleitoral",
  ROUTE: "Rota",
  DELIVERY: "Entrega",
  TRANSMISSION: "Transmissão",
  RISK: "Risco",
  COMMUNICATION: "Comunicado",
  FIELD_TEAM: "Equipe de campo",
  OTHER: "Outro registro",
};

export const EVIDENCE_EVENT_LABELS: Record<string, string> = {
  CREATED: "Registrada",
  UPLOADED: "Arquivo enviado",
  VERSION_ADDED: "Nova versão",
  METADATA_UPDATED: "Metadados atualizados",
  LINK_ADDED: "Vínculo adicionado",
  LINK_REMOVED: "Vínculo removido",
  ARCHIVED: "Arquivada",
  RESTORED: "Restaurada",
  DOWNLOADED: "Arquivo baixado",
};

/** Tipos cujo conteúdo é necessariamente uma imagem. */
export const EVIDENCE_IMAGE_TYPES: EvidenceType[] = ["PHOTO", "SCREENSHOT"];

export interface EvidenceTagSummary {
  id: string;
  label: string;
  slug: string;
  usageCount?: number;
}

export interface EvidenceVersionSummary {
  id: string;
  evidenceId: string;
  number: number;
  fileName: string;
  extension: string;
  mimeType: string;
  size: number;
  checksum: string;
  storageDriver: string;
  reason: string | null;
  description: string | null;
  authorId: string | null;
  authorName: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface EvidenceLinkSummary {
  id: string;
  evidenceId: string;
  type: EvidenceLinkType;
  targetId: string;
  targetLabel: string | null;
  notes: string | null;
  createdAt: string;
}

export interface EvidenceEventSummary {
  id: string;
  type: string;
  message: string;
  actorId: string | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface EvidenceSummary {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: EvidenceType;
  status: EvidenceStatus;
  electionId: string | null;
  authorId: string | null;
  authorName: string;
  origin: string | null;
  observations: string | null;
  capturedAt: string | null;
  currentVersion: number;
  versionCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  election: { id: string; name: string; year: number } | null;
  tags: EvidenceTagSummary[];
  links: EvidenceLinkSummary[];
  /** Versão corrente, com tamanho, MIME e checksum do arquivo. */
  version?: EvidenceVersionSummary | null;
  timeline?: EvidenceEventSummary[];
}

export interface EvidenceDashboard {
  total: number;
  active: number;
  archived: number;
  byType: Array<{ type: EvidenceType; total: number }>;
  withLinks: number;
  withoutLinks: number;
  totalBytes: number;
  addedLastSevenDays: number;
  topTags: Array<{ tagId: string; label: string; total: number }>;
}

export interface EvidenceLinkInput {
  type: EvidenceLinkType;
  targetId: string;
  notes?: string;
}

export interface EvidenceMetadataInput {
  title: string;
  description?: string;
  type: EvidenceType;
  electionId?: string;
  origin?: string;
  observations?: string;
  capturedAt?: string;
  tags: string[];
}
