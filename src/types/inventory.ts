export type InventoryUnit = "UN" | "L" | "KG" | "M" | "CX";
export type InventoryItemStatus = "ATIVO" | "INATIVO";
export type InventoryMovementType =
  | "ENTRADA" | "SAIDA" | "RESERVA" | "CANCELAMENTO_RESERVA" | "CONSUMO_OS" | "DEVOLUCAO_OS"
  | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO" | "TRANSFERENCIA" | "INVENTARIO" | "BAIXA_POR_PERDA" | "BAIXA_POR_VALIDADE";

export interface InventoryItem {
  id: string;
  empresaId: string;
  plantaId?: string;
  code: string;
  description: string;
  category: string;
  unit: InventoryUnit;
  manufacturer?: string;
  reference?: string;
  barcode?: string;
  status: InventoryItemStatus;
  batchControlled: boolean;
  serialControlled: boolean;
  expiryControlled: boolean;
  minimumStock: number;
  maximumStock?: number;
  reorderPoint: number;
  defaultLocation: string;
  quantityTotal: number;
  quantityReserved: number;
  quantityBlocked: number;
  averageCost?: number;
  batch?: string;
  expiryDate?: string;
  serialNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemDraft {
  code: string;
  description: string;
  category: string;
  unit: InventoryUnit;
  manufacturer?: string;
  reference?: string;
  minimumStock: number;
  maximumStock?: number;
  reorderPoint: number;
  defaultLocation: string;
  averageCost?: number;
  batchControlled: boolean;
  expiryControlled: boolean;
  batch?: string;
  expiryDate?: string;
}

export interface InventoryMovement {
  id: string;
  empresaId: string;
  type: InventoryMovementType;
  itemId: string;
  itemCode: string;
  quantity: number;
  unit: InventoryUnit;
  source?: string;
  destination?: string;
  workOrderId?: string;
  workOrderNumber?: string;
  userId: string;
  userName: string;
  reason: string;
  unitCost?: number;
  totalCost?: number;
  document?: string;
  note?: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface InventoryActor { id: string; name: string; }
export interface InventoryOperation {
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  workOrderId?: string;
  source?: string;
  destination?: string;
  document?: string;
  note?: string;
  idempotencyKey?: string;
}

export type ToolStatus = "DISPONIVEL" | "EMPRESTADA" | "INATIVA";
export interface ToolHistoryEvent { id: string; type: "CADASTRO" | "EMPRESTIMO" | "DEVOLUCAO" | "INATIVACAO"; description: string; userId: string; userName: string; at: string; }
export interface InventoryTool {
  id: string;
  empresaId: string;
  code: string;
  description: string;
  status: ToolStatus;
  condition: string;
  location: string;
  responsible?: string;
  loanedTo?: string;
  workOrderId?: string;
  workOrderNumber?: string;
  withdrawnAt?: string;
  dueAt?: string;
  returnedAt?: string;
  createdAt: string;
  updatedAt: string;
  history: ToolHistoryEvent[];
}

export interface ToolDraft { code: string; description: string; condition: string; location: string; }
export function availableQuantity(item: InventoryItem): number { return item.quantityTotal - item.quantityReserved - item.quantityBlocked; }
export const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  ENTRADA: "Entrada", SAIDA: "Saída", RESERVA: "Reserva", CANCELAMENTO_RESERVA: "Cancelamento de reserva",
  CONSUMO_OS: "Consumo em O.S.", DEVOLUCAO_OS: "Devolução de O.S.", AJUSTE_POSITIVO: "Ajuste positivo",
  AJUSTE_NEGATIVO: "Ajuste negativo", TRANSFERENCIA: "Transferência", INVENTARIO: "Inventário",
  BAIXA_POR_PERDA: "Baixa por perda", BAIXA_POR_VALIDADE: "Baixa por validade"
};
