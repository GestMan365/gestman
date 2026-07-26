export type WorkOrderStatus =
  | "ABERTA"
  | "EM_ANALISE"
  | "PLANEJADA"
  | "AGUARDANDO_MATERIAL"
  | "AGUARDANDO_LIBERACAO"
  | "ATRIBUIDA"
  | "EM_EXECUCAO"
  | "PAUSADA"
  | "CONCLUIDA"
  | "ENCERRADA"
  | "CANCELADA";

export type MaintenanceType =
  | "CORRETIVA"
  | "PREVENTIVA"
  | "PREDITIVA"
  | "INSPECAO"
  | "MELHORIA"
  | "CALIBRACAO"
  | "LUBRIFICACAO"
  | "INSTALACAO"
  | "SERVICO_GERAL";

export type WorkOrderPriority = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type WorkOrderCriticality = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export interface WorkOrderHistoryEvent {
  id: string;
  type: "CRIACAO" | "STATUS" | "PLANEJAMENTO" | "ATRIBUICAO" | "APONTAMENTO" | "PAUSA" | "RETOMADA" | "CONCLUSAO" | "ENCERRAMENTO" | "REABERTURA" | "CANCELAMENTO" | "MATERIAL" | "FERRAMENTA";
  description: string;
  at: string;
  actorId: string;
  actorName: string;
}

export interface WorkOrderMaterial {
  id: string;
  inventoryItemId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
}

export interface WorkOrderInventoryMovement {
  movementId: string;
  type: "RESERVA" | "CANCELAMENTO_RESERVA" | "CONSUMO_OS" | "DEVOLUCAO_OS";
  itemId: string;
  itemCode: string;
  quantity: number;
  unit: string;
  totalCost?: number;
  at: string;
}

export interface WorkOrder {
  id: string;
  empresaId: string;
  plantaId?: string;
  number: string;
  requestId?: string;
  sourceRequestNumber?: string;
  maintenancePlanId?: string;
  maintenancePlanCode?: string;
  maintenancePlanVersion?: number;
  maintenanceCompetence?: string;
  requesterId?: string;
  requesterName?: string;
  assetId?: string;
  sectorId?: string;
  locationId?: string;
  title: string;
  description: string;
  maintenanceType: MaintenanceType;
  priority: WorkOrderPriority;
  criticality: WorkOrderCriticality;
  status: WorkOrderStatus;
  plannerId?: string;
  responsibleId?: string;
  technicianId?: string;
  technicianName?: string;
  teamId?: string;
  plannedDate?: string;
  estimatedDurationMinutes?: number;
  plannedMaterials: WorkOrderMaterial[];
  reservedMaterials: WorkOrderMaterial[];
  plannedTools: string[];
  instructions?: string;
  procedure?: string;
  risks?: string;
  safetyLocks?: string;
  startedAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  completedAt?: string;
  closedAt?: string;
  workingMinutes: number;
  downtimeMinutes: number;
  participants: string[];
  usedMaterials: WorkOrderMaterial[];
  inventoryMovements: WorkOrderInventoryMovement[];
  usedTools: string[];
  observations: string[];
  photos: string[];
  attachments: string[];
  checklist: string[];
  measurements: string[];
  symptom?: string;
  failureMode?: string;
  cause?: string;
  actionTaken?: string;
  solution?: string;
  recommendation?: string;
  followUpRequired: boolean;
  recurrence: boolean;
  completedBy?: string;
  closedBy?: string;
  requesterAcceptance?: string;
  signature?: string;
  pauseReason?: string;
  cancelReason?: string;
  reopenReason?: string;
  createdAt: string;
  updatedAt: string;
  isCancelled: boolean;
  history: WorkOrderHistoryEvent[];
}

export interface WorkOrderDraft {
  title: string;
  description: string;
  maintenanceType: MaintenanceType;
  priority: WorkOrderPriority;
  criticality: WorkOrderCriticality;
  assetId?: string;
  sectorId?: string;
  locationId?: string;
  symptom?: string;
}

export interface WorkOrderPlan {
  plannedDate: string;
  estimatedDurationMinutes: number;
  instructions?: string;
  risks?: string;
  safetyLocks?: string;
}

export interface WorkOrderExecutionLog {
  observation?: string;
  actionTaken?: string;
  workingMinutes: number;
  downtimeMinutes: number;
}

export interface WorkOrderActor {
  id: string;
  name: string;
}

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  PLANEJADA: "Planejada",
  AGUARDANDO_MATERIAL: "Aguardando material",
  AGUARDANDO_LIBERACAO: "Aguardando liberação",
  ATRIBUIDA: "Atribuída",
  EM_EXECUCAO: "Em execução",
  PAUSADA: "Pausada",
  CONCLUIDA: "Concluída",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada"
};

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  CORRETIVA: "Corretiva",
  PREVENTIVA: "Preventiva",
  PREDITIVA: "Preditiva",
  INSPECAO: "Inspeção",
  MELHORIA: "Melhoria",
  CALIBRACAO: "Calibração",
  LUBRIFICACAO: "Lubrificação",
  INSTALACAO: "Instalação",
  SERVICO_GERAL: "Serviço geral"
};

export const WORK_ORDER_PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica"
};
