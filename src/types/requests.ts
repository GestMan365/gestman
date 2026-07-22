export type RequestStatus =
  | "ABERTA"
  | "EM_ANALISE"
  | "APROVADA"
  | "REJEITADA"
  | "CONVERTIDA_EM_OS"
  | "CANCELADA";

export type RequestPriority = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export type RequestType = "CORRETIVA" | "INSPECAO" | "MELHORIA" | "OUTRO";

export interface MaintenanceRequest {
  id: string;
  empresaId: string;
  plantaId?: string;
  setorId?: string;
  localId?: string;
  assetId?: string;
  number: string;
  title: string;
  description: string;
  type: RequestType;
  priority: RequestPriority;
  status: RequestStatus;
  requesterId: string;
  requesterName: string;
  responsibleId?: string;
  channel: "WEB";
  openedAt: string;
  desiredDate?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  workOrderId?: string;
  observations?: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  isCancelled: boolean;
  conversionPreparedAt?: string;
}

export interface RequestDraft {
  title: string;
  description: string;
  type: RequestType;
  priority: RequestPriority;
  sectorId?: string;
  locationId?: string;
  assetId?: string;
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  CONVERTIDA_EM_OS: "Convertida em O.S.",
  CANCELADA: "Cancelada"
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica"
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  CORRETIVA: "Problema no equipamento",
  INSPECAO: "Inspeção necessária",
  MELHORIA: "Sugestão de melhoria",
  OUTRO: "Outro"
};
