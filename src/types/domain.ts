export type EntityId = string;

export interface BaseEntity {
  id: EntityId;
  empresaId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetBase extends BaseEntity {
  code: string;
  name: string;
  locationId?: string;
  status: "OPERANDO" | "PARADO" | "INATIVO";
}

export interface WorkOrderBase extends BaseEntity {
  number: string;
  assetId: string;
  requesterId: string;
  executorId?: string;
  status: "ABERTA" | "EM_EXECUCAO" | "CONCLUIDA" | "CANCELADA";
}
