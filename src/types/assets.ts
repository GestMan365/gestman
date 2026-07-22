export type AssetStatus = "OPERANDO" | "EM_MANUTENCAO" | "PARADO" | "INATIVO";

export type AssetCriticality = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export interface Asset {
  id: string;
  empresaId: string;
  plantaId?: string;
  setorId?: string;
  localId?: string;
  tag: string;
  name: string;
  description?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  manufactureYear?: number;
  installationDate?: string;
  status: AssetStatus;
  criticality: AssetCriticality;
  responsible?: string;
  parentAssetId?: string;
  costCenter?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDraft {
  tag: string;
  name: string;
  description?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  sectorId?: string;
  locationId?: string;
  status: AssetStatus;
  criticality: AssetCriticality;
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  OPERANDO: "Operando",
  EM_MANUTENCAO: "Em manutenção",
  PARADO: "Parado",
  INATIVO: "Inativo"
};

export const ASSET_CRITICALITY_LABELS: Record<AssetCriticality, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica"
};
