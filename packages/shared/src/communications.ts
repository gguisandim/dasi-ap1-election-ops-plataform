/**
 * Contratos compartilhados do domínio de Comunicações Operacionais.
 *
 * O plugin `@eops/plugin-communications` é o dono destes tipos. Outros domínios
 * (Centro de Comando, Relatórios) consomem apenas estes contratos, nunca o
 * service interno do plugin.
 */

export const COMMUNICATION_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export const COMMUNICATION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "EXPIRED",
  "ARCHIVED",
  "CANCELLED",
] as const;
export const COMMUNICATION_AUDIENCE_TYPES = [
  "ALL",
  "ELECTORAL_ZONE",
  "POLLING_PLACE",
  "FIELD_TEAM",
  "OPERATIONAL_ROLE",
  "USER",
] as const;
export const COMMUNICATION_DELIVERY_STATUSES = [
  "PENDING",
  "DELIVERED",
  "VIEWED",
  "CONFIRMED",
] as const;

export type CommunicationPriority = (typeof COMMUNICATION_PRIORITIES)[number];
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];
export type CommunicationAudienceType = (typeof COMMUNICATION_AUDIENCE_TYPES)[number];
export type CommunicationDeliveryStatus = (typeof COMMUNICATION_DELIVERY_STATUSES)[number];

/** Prioridades que exigem destaque visual e alerta operacional. */
export const COMMUNICATION_URGENT_PRIORITIES: CommunicationPriority[] = ["HIGH", "CRITICAL"];

/** Estados em que o comunicado já alcançou destinatários. */
export const COMMUNICATION_DISPATCHED_STATUSES: CommunicationStatus[] = [
  "PUBLISHED",
  "EXPIRED",
];

export const COMMUNICATION_PRIORITY_LABELS: Record<CommunicationPriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const COMMUNICATION_STATUS_LABELS: Record<CommunicationStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  EXPIRED: "Expirado",
  ARCHIVED: "Arquivado",
  CANCELLED: "Cancelado",
};

export const COMMUNICATION_DELIVERY_LABELS: Record<CommunicationDeliveryStatus, string> = {
  PENDING: "Pendente",
  DELIVERED: "Entregue",
  VIEWED: "Lido",
  CONFIRMED: "Confirmado",
};

export const COMMUNICATION_AUDIENCE_LABELS: Record<CommunicationAudienceType, string> = {
  ALL: "Todos",
  ELECTORAL_ZONE: "Zona eleitoral",
  POLLING_PLACE: "Local de votação",
  FIELD_TEAM: "Equipe de campo",
  OPERATIONAL_ROLE: "Função operacional",
  USER: "Usuário específico",
};

export const COMMUNICATION_EVENT_LABELS: Record<string, string> = {
  CREATED: "Criado",
  UPDATED: "Editado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  DISPATCHED: "Enviado",
  RECIPIENTS_SYNCED: "Destinatários atualizados",
  VIEWED: "Lido",
  CONFIRMED: "Confirmado",
  EXPIRED: "Expirado",
  ARCHIVED: "Arquivado",
  CANCELLED: "Cancelado",
};

export interface CommunicationCategorySummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
}

export interface CommunicationTagSummary {
  id: string;
  label: string;
  slug: string;
}

export interface CommunicationAudienceSummary {
  id: string;
  type: CommunicationAudienceType;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  fieldTeamId: string | null;
  fieldRoleId: string | null;
  userId: string | null;
  label: string | null;
}

export interface CommunicationEventSummary {
  id: string;
  type: string;
  message: string;
  actorId: string | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface CommunicationElectionRef {
  id: string;
  name: string;
  year: number;
}

export interface CommunicationSummary {
  id: string;
  code: string;
  title: string;
  content: string;
  priority: CommunicationPriority;
  status: CommunicationStatus;
  electionId: string;
  categoryId: string | null;
  authorId: string | null;
  authorName: string;
  observations: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  dispatchedAt: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  cancelledAt: string | null;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
  election: CommunicationElectionRef;
  category: CommunicationCategorySummary | null;
  tags: CommunicationTagSummary[];
  audiences: CommunicationAudienceSummary[];
  /** Verdadeiro quando `PUBLISHED` e `expiresAt` já passou. */
  expired: boolean;
  /** Verdadeiro quando a prioridade exige destaque visual. */
  urgent: boolean;
  /** Métricas resumidas de acompanhamento de leitura. */
  metrics?: CommunicationMetrics;
  timeline?: CommunicationEventSummary[];
}

export interface CommunicationMetrics {
  total: number;
  delivered: number;
  viewed: number;
  confirmed: number;
  pending: number;
  deliveryRate: number;
  readRate: number;
  confirmationRate: number;
}

export interface CommunicationDashboard {
  published: number;
  scheduled: number;
  drafts: number;
  urgent: number;
  critical: number;
  expired: number;
  pendingConfirmations: number;
  readRate: number;
  confirmationRate: number;
  topCategories: Array<{ categoryId: string | null; name: string; total: number }>;
}

export interface CommunicationRecipientSummary {
  id: string;
  communicationId: string;
  audienceId: string | null;
  userId: string | null;
  memberId: string | null;
  name: string;
  email: string | null;
  roleLabel: string | null;
  sourceLabel: string | null;
  deliveryStatus: CommunicationDeliveryStatus;
  deliveredAt: string | null;
  viewedAt: string | null;
  confirmedAt: string | null;
  confirmationNote: string | null;
  communication?: Pick<CommunicationSummary, "id" | "code" | "title" | "priority" | "status" | "publishedAt" | "expiresAt">;
}

export interface CommunicationTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  defaultTitle: string;
  body: string;
  priority: CommunicationPriority;
  categoryId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  category: CommunicationCategorySummary | null;
}

/** Direcionamento enviado pela interface para um comunicado. */
export interface CommunicationAudienceInput {
  type: CommunicationAudienceType;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  fieldTeamId?: string;
  fieldRoleId?: string;
  userId?: string;
}

export interface CommunicationFormInput {
  title: string;
  content: string;
  priority: CommunicationPriority;
  electionId: string;
  categoryId?: string;
  observations?: string;
  expiresAt?: string;
  scheduledAt?: string;
  tags: string[];
  audiences: CommunicationAudienceInput[];
}
