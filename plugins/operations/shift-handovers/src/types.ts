export type HandoverStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "CANCELLED";

export interface ShiftHandover {
  id: string;
  shiftId: string;
  senderUserId: string;
  recipientUserId: string;
  summary: string;
  pendingNotes?: string | null;
  observations?: string | null;
  status: HandoverStatus;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  shift: {
    id: string;
    name?: string | null;
    status: string;
    startsAt: string;
    endsAt: string;
    team: { id: string; name: string; election: { id: string; name: string } };
    electoralZone?: { id: string; name: string; number: number } | null;
    pollingPlace?: { id: string; name: string } | null;
  };
  sender: { id: string; name: string; email: string };
  recipient: { id: string; name: string; email: string };
  incidents: Array<{ incident: { id: string; code: string; title: string; status: string; severity: string } }>;
  tasks: Array<{ task: { id: string; title: string; status: string; priority: string } }>;
  assets: Array<{ asset: { id: string; assetTag: string; name: string; status: string; condition: string } }>;
  history: Array<{ id: string; action: string; description: string; createdAt: string; metadata?: unknown; actor?: { id: string; name: string } | null }>;
  availableActions: string[];
}

export interface HandoverInput {
  shiftId: string;
  recipientUserId: string;
  summary: string;
  pendingNotes?: string;
  observations?: string;
  incidentIds?: string[];
  taskIds?: string[];
  assetIds?: string[];
}
