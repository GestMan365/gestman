import type { MaintenanceType, WorkOrderCriticality, WorkOrderPriority } from "@/types/workOrders";

export type MaintenancePlanStatus = "RASCUNHO" | "ATIVO" | "SUSPENSO" | "VENCIDO" | "ARQUIVADO";
export type MaintenanceTriggerType = "CALENDARIO" | "HORIMETRO" | "QUILOMETRAGEM" | "CICLOS" | "MEDICAO" | "CONDICAO" | "EVENTO";
export type CalendarUnit = "DIA" | "SEMANA" | "MES" | "ANO";
export type ChecklistAnswerType = "SIM_NAO" | "NUMERO" | "TEXTO" | "MEDICAO";

export interface MaintenanceChecklistItem {
  id: string;
  description: string;
  required: boolean;
  answerType: ChecklistAnswerType;
  order: number;
}

export interface MaintenancePlanHistoryEvent {
  id: string;
  type: "CRIACAO" | "EDICAO" | "ATIVACAO" | "SUSPENSAO" | "REATIVACAO" | "ARQUIVAMENTO" | "GERACAO_OS" | "LEITURA";
  description: string;
  at: string;
  actorId: string;
  actorName: string;
}

export interface MaintenancePlan {
  id: string;
  empresaId: string;
  plantaId?: string;
  assetId: string;
  code: string;
  name: string;
  description: string;
  maintenanceType: Extract<MaintenanceType, "PREVENTIVA" | "PREDITIVA" | "INSPECAO" | "CALIBRACAO" | "LUBRIFICACAO">;
  criticality: WorkOrderCriticality;
  defaultPriority: WorkOrderPriority;
  status: MaintenancePlanStatus;
  version: number;
  triggerType: MaintenanceTriggerType;
  frequency: number;
  calendarUnit?: CalendarUnit;
  startDate: string;
  nextExecution: string;
  lastExecution?: string;
  advanceDays: number;
  toleranceDays: number;
  meterCurrent?: number;
  meterLimit?: number;
  meterUnit?: "HORAS" | "KM" | "CICLOS";
  estimatedDurationMinutes: number;
  procedure: string;
  instructions?: string;
  risks?: string;
  ppe?: string;
  lockoutTagout?: string;
  plannedMaterials: string[];
  plannedTools: string[];
  plannedTeam?: string;
  requiredQualification?: string;
  checklistVersion: number;
  checklist: MaintenanceChecklistItem[];
  suspensionReason?: string;
  suspendedAt?: string;
  validUntil?: string;
  generatedWorkOrderIds: string[];
  createdAt: string;
  updatedAt: string;
  history: MaintenancePlanHistoryEvent[];
}

export interface MaintenancePlanDraft {
  code: string;
  assetId: string;
  name: string;
  description: string;
  maintenanceType: MaintenancePlan["maintenanceType"];
  criticality: WorkOrderCriticality;
  defaultPriority: WorkOrderPriority;
  triggerType: MaintenanceTriggerType;
  frequency: number;
  calendarUnit?: CalendarUnit;
  startDate: string;
  advanceDays: number;
  toleranceDays: number;
  meterCurrent?: number;
  meterLimit?: number;
  estimatedDurationMinutes: number;
  procedure: string;
  instructions?: string;
  plannedMaterials: string[];
  plannedTools: string[];
  checklist: MaintenanceChecklistItem[];
}

export interface MaintenancePlanActor { id: string; name: string; }

export const PLAN_STATUS_LABELS: Record<MaintenancePlanStatus, string> = {
  RASCUNHO: "Rascunho", ATIVO: "Ativo", SUSPENSO: "Suspenso", VENCIDO: "Vencido", ARQUIVADO: "Arquivado"
};

export const TRIGGER_TYPE_LABELS: Record<MaintenanceTriggerType, string> = {
  CALENDARIO: "Calendário", HORIMETRO: "Horímetro", QUILOMETRAGEM: "Quilometragem", CICLOS: "Ciclos",
  MEDICAO: "Medição", CONDICAO: "Condição", EVENTO: "Evento"
};
