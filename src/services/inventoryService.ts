import { isDemoAuthMode } from "@/services/supabaseClient";
import { workOrderService } from "@/services/workOrderService";
import type {
  InventoryActor,
  InventoryItem,
  InventoryItemDraft,
  InventoryMovement,
  InventoryOperation,
  InventoryTool,
  ToolDraft
} from "@/types/inventory";
import { availableQuantity } from "@/types/inventory";

const ITEM_PREFIX = "QA-AUTO-EST";
const TOOL_PREFIX = "QA-AUTO-FERR";
const STORAGE_PREFIX = "gestman365.demo.inventory";
const SEED_VERSION = "1";

interface InventoryState {
  items: InventoryItem[];
  movements: InventoryMovement[];
  tools: InventoryTool[];
}

export class InventoryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryServiceError";
  }
}

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function key(empresaId: string): string {
  return `${STORAGE_PREFIX}.${empresaId}`;
}

function seedKey(empresaId: string): string {
  return `${key(empresaId)}.seed-version`;
}

function now(): string {
  return new Date().toISOString();
}

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

function requireDemo(): void {
  if (!isDemoAuthMode) {
    throw new InventoryServiceError("O backend de estoque ainda não foi configurado neste ambiente. Nenhum dado remoto foi alterado.");
  }
}

function copyState(state: InventoryState): InventoryState {
  return {
    items: state.items.map(item => ({ ...item })),
    movements: state.movements.map(item => ({ ...item })),
    tools: state.tools.map(tool => ({ ...tool, history: tool.history.map(event => ({ ...event })) }))
  };
}

function seedItem(empresaId: string, partial: Partial<InventoryItem> & Pick<InventoryItem, "id" | "code" | "description" | "category" | "unit" | "quantityTotal" | "minimumStock" | "reorderPoint" | "defaultLocation">): InventoryItem {
  const createdAt = "2026-07-22T12:00:00.000Z";
  return {
    empresaId,
    status: "ATIVO",
    batchControlled: false,
    serialControlled: false,
    expiryControlled: false,
    quantityReserved: 0,
    quantityBlocked: 0,
    createdAt,
    updatedAt: createdAt,
    ...partial
  };
}

function seeds(empresaId: string): InventoryState {
  const items = [
    seedItem(empresaId, { id: "qa-auto-est-rol-6205", code: "QA-AUTO-EST-ROL-6205", description: "Rolamento 6205 ZZ", category: "Rolamentos", unit: "UN", quantityTotal: 20, minimumStock: 5, maximumStock: 30, reorderPoint: 8, defaultLocation: "A-01-01", averageCost: 48.5, manufacturer: "SKF" }),
    seedItem(empresaId, { id: "qa-auto-est-cor-a42", code: "QA-AUTO-EST-COR-A42", description: "Correia A42", category: "Transmissão", unit: "UN", quantityTotal: 10, minimumStock: 3, maximumStock: 20, reorderPoint: 5, defaultLocation: "A-02-03", averageCost: 32 }),
    seedItem(empresaId, { id: "qa-auto-est-oleo-iso68", code: "QA-AUTO-EST-OLEO-ISO68", description: "Óleo lubrificante ISO VG 68", category: "Lubrificantes", unit: "L", quantityTotal: 50, minimumStock: 10, maximumStock: 80, reorderPoint: 15, defaultLocation: "B-01-02", averageCost: 18.9 }),
    seedItem(empresaId, { id: "qa-auto-est-filtro-001", code: "QA-AUTO-EST-FILTRO-001", description: "Elemento filtrante do compressor", category: "Filtros", unit: "UN", quantityTotal: 8, minimumStock: 2, maximumStock: 12, reorderPoint: 3, defaultLocation: "A-03-04" })
  ];
  const actor = { userId: "qa-seed", userName: "Seed QA" };
  const movements = items.map((item, index): InventoryMovement => ({
    id: `qa-auto-est-mov-${index + 1}`,
    empresaId,
    type: "ENTRADA",
    itemId: item.id,
    itemCode: item.code,
    quantity: item.quantityTotal,
    unit: item.unit,
    destination: item.defaultLocation,
    ...actor,
    reason: "Saldo inicial controlado do conjunto QA.",
    unitCost: item.averageCost,
    totalCost: item.averageCost == null ? undefined : item.quantityTotal * item.averageCost,
    idempotencyKey: `seed-${item.id}`,
    createdAt: "2026-07-22T12:00:00.000Z"
  }));
  const tools: InventoryTool[] = [{
    id: "qa-auto-ferr-001",
    empresaId,
    code: "QA-AUTO-FERR-001",
    description: "Torquímetro 20–100 N·m",
    status: "DISPONIVEL",
    condition: "Calibrado",
    location: "Ferramentaria F-01",
    createdAt: "2026-07-22T12:00:00.000Z",
    updatedAt: "2026-07-22T12:00:00.000Z",
    history: [{ id: "qa-auto-ferr-event-001", type: "CADASTRO", description: "Ferramenta incluída pelo conjunto QA.", userId: "qa-seed", userName: "Seed QA", at: "2026-07-22T12:00:00.000Z" }]
  }];
  return { items, movements, tools };
}

function validState(value: unknown): value is InventoryState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<InventoryState>;
  return Array.isArray(state.items) && Array.isArray(state.movements) && Array.isArray(state.tools);
}

function read(empresaId: string): InventoryState {
  const target = storage();
  if (!target) return seeds(empresaId);
  if (target.getItem(seedKey(empresaId)) !== SEED_VERSION) {
    const state = seeds(empresaId);
    write(empresaId, state);
    target.setItem(seedKey(empresaId), SEED_VERSION);
    return state;
  }
  try {
    const parsed: unknown = JSON.parse(target.getItem(key(empresaId)) ?? "null");
    if (validState(parsed)) return parsed;
  } catch {
    // A sessão demo pode se recuperar sem escrever em backend remoto.
  }
  const state = seeds(empresaId);
  write(empresaId, state);
  return state;
}

function write(empresaId: string, state: InventoryState): void {
  storage()?.setItem(key(empresaId), JSON.stringify(state));
}

function findItem(state: InventoryState, empresaId: string, id: string): InventoryItem {
  const item = state.items.find(candidate => candidate.id === id && candidate.empresaId === empresaId);
  if (!item) throw new InventoryServiceError("Item de estoque não encontrado nesta empresa.");
  return item;
}

function findTool(state: InventoryState, empresaId: string, id: string): InventoryTool {
  const tool = state.tools.find(candidate => candidate.id === id && candidate.empresaId === empresaId);
  if (!tool) throw new InventoryServiceError("Ferramenta não encontrada nesta empresa.");
  return tool;
}

function validateDraft(draft: InventoryItemDraft, items: InventoryItem[], ignoreId?: string): void {
  const code = normalize(draft.code);
  if (!code.startsWith(ITEM_PREFIX)) throw new InventoryServiceError(`No modo demo, use o prefixo ${ITEM_PREFIX}.`);
  if (items.some(item => item.id !== ignoreId && normalize(item.code) === code)) throw new InventoryServiceError("Já existe um item com este código nesta empresa.");
  if (draft.description.trim().length < 3) throw new InventoryServiceError("Informe a descrição do item.");
  if (!draft.category.trim() || !draft.defaultLocation.trim()) throw new InventoryServiceError("Informe categoria e localização padrão.");
  if (![draft.minimumStock, draft.reorderPoint].every(value => Number.isFinite(value) && value >= 0)) throw new InventoryServiceError("Os níveis de estoque devem ser números iguais ou maiores que zero.");
  if (draft.maximumStock != null && draft.maximumStock < draft.minimumStock) throw new InventoryServiceError("O estoque máximo não pode ser menor que o estoque mínimo.");
  if (draft.averageCost != null && (!Number.isFinite(draft.averageCost) || draft.averageCost < 0)) throw new InventoryServiceError("O custo médio não pode ser negativo.");
  if (draft.expiryControlled && !draft.expiryDate) throw new InventoryServiceError("Informe a validade do item controlado por validade.");
}

function movementQuantity(state: InventoryState, workOrderId: string, itemId: string, type: "RESERVA" | "CANCELAMENTO_RESERVA" | "CONSUMO_OS" | "DEVOLUCAO_OS"): number {
  return state.movements.filter(movement => movement.workOrderId === workOrderId && movement.itemId === itemId && movement.type === type).reduce((sum, movement) => sum + movement.quantity, 0);
}

function validateOperation(item: InventoryItem, state: InventoryState, operation: InventoryOperation): void {
  if (item.status !== "ATIVO") throw new InventoryServiceError("Item inativo não aceita movimentações.");
  if (!Number.isFinite(operation.quantity) || operation.quantity <= 0) throw new InventoryServiceError("A quantidade deve ser maior que zero.");
  if (!operation.reason.trim()) throw new InventoryServiceError("Informe o motivo da movimentação.");
  const available = availableQuantity(item);
  if (["SAIDA", "RESERVA", "AJUSTE_NEGATIVO", "BAIXA_POR_PERDA", "BAIXA_POR_VALIDADE"].includes(operation.type) && operation.quantity > available) {
    throw new InventoryServiceError("Saldo disponível insuficiente para esta movimentação.");
  }
  if (["RESERVA", "CANCELAMENTO_RESERVA", "CONSUMO_OS", "DEVOLUCAO_OS"].includes(operation.type) && !operation.workOrderId) {
    throw new InventoryServiceError("Selecione a Ordem de Serviço relacionada.");
  }
  if (operation.type === "CANCELAMENTO_RESERVA" && operation.workOrderId) {
    const outstanding = movementQuantity(state, operation.workOrderId, item.id, "RESERVA") - movementQuantity(state, operation.workOrderId, item.id, "CANCELAMENTO_RESERVA") - movementQuantity(state, operation.workOrderId, item.id, "CONSUMO_OS");
    if (operation.quantity > outstanding) throw new InventoryServiceError("A quantidade supera a reserva disponível nesta O.S.");
  }
  if (operation.type === "DEVOLUCAO_OS" && operation.workOrderId) {
    const consumed = movementQuantity(state, operation.workOrderId, item.id, "CONSUMO_OS") - movementQuantity(state, operation.workOrderId, item.id, "DEVOLUCAO_OS");
    if (operation.quantity > consumed) throw new InventoryServiceError("A devolução não pode superar o consumo registrado nesta O.S.");
  }
  if (operation.type === "CONSUMO_OS" && operation.workOrderId) {
    const ownReservation = Math.max(0, movementQuantity(state, operation.workOrderId, item.id, "RESERVA") - movementQuantity(state, operation.workOrderId, item.id, "CANCELAMENTO_RESERVA") - movementQuantity(state, operation.workOrderId, item.id, "CONSUMO_OS"));
    if (operation.quantity > available + ownReservation) throw new InventoryServiceError("Saldo disponível insuficiente para o consumo desta O.S.");
  }
  if (operation.type === "TRANSFERENCIA" && (!operation.source?.trim() || !operation.destination?.trim() || operation.source.trim() === operation.destination.trim())) {
    throw new InventoryServiceError("Informe locais de origem e destino diferentes.");
  }
}

function applyBalance(item: InventoryItem, operation: InventoryOperation, reservationConsumed = 0): InventoryItem {
  let quantityTotal = item.quantityTotal;
  let quantityReserved = item.quantityReserved;
  let defaultLocation = item.defaultLocation;
  if (["ENTRADA", "AJUSTE_POSITIVO", "DEVOLUCAO_OS"].includes(operation.type)) quantityTotal += operation.quantity;
  if (["SAIDA", "AJUSTE_NEGATIVO", "BAIXA_POR_PERDA", "BAIXA_POR_VALIDADE", "CONSUMO_OS"].includes(operation.type)) quantityTotal -= operation.quantity;
  if (operation.type === "RESERVA") quantityReserved += operation.quantity;
  if (operation.type === "CANCELAMENTO_RESERVA") quantityReserved -= operation.quantity;
  if (operation.type === "CONSUMO_OS") quantityReserved = Math.max(0, quantityReserved - reservationConsumed);
  if (operation.type === "TRANSFERENCIA") defaultLocation = operation.destination!.trim();
  if (operation.type === "INVENTARIO") {
    if (operation.quantity < item.quantityReserved + item.quantityBlocked) throw new InventoryServiceError("A contagem não pode ser menor que o saldo reservado e bloqueado.");
    quantityTotal = operation.quantity;
  }
  if (quantityTotal < 0 || quantityReserved < 0 || quantityReserved + item.quantityBlocked > quantityTotal) throw new InventoryServiceError("A operação produziria saldo inválido.");
  return { ...item, quantityTotal, quantityReserved, defaultLocation, updatedAt: now() };
}

export const inventoryService = {
  qaItemPrefix: ITEM_PREFIX,
  qaToolPrefix: TOOL_PREFIX,
  demoStorageKey: key,

  async list(empresaId: string): Promise<InventoryState> {
    requireDemo();
    const state = read(empresaId);
    return copyState({
      items: state.items.filter(item => item.empresaId === empresaId),
      movements: state.movements.filter(movement => movement.empresaId === empresaId),
      tools: state.tools.filter(tool => tool.empresaId === empresaId)
    });
  },

  async createItem(empresaId: string, draft: InventoryItemDraft): Promise<InventoryItem> {
    requireDemo();
    const state = read(empresaId);
    validateDraft(draft, state.items);
    const createdAt = now();
    const item: InventoryItem = {
      ...draft,
      id: `demo-inventory-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      empresaId,
      code: normalize(draft.code),
      description: draft.description.trim(),
      category: draft.category.trim(),
      defaultLocation: draft.defaultLocation.trim(),
      status: "ATIVO",
      serialControlled: false,
      quantityTotal: 0,
      quantityReserved: 0,
      quantityBlocked: 0,
      createdAt,
      updatedAt: createdAt
    };
    write(empresaId, { ...state, items: [...state.items, item] });
    return { ...item };
  },

  async updateItem(empresaId: string, id: string, draft: InventoryItemDraft): Promise<InventoryItem> {
    requireDemo();
    const state = read(empresaId);
    const current = findItem(state, empresaId, id);
    validateDraft(draft, state.items, id);
    const updated: InventoryItem = { ...current, ...draft, code: normalize(draft.code), description: draft.description.trim(), category: draft.category.trim(), defaultLocation: draft.defaultLocation.trim(), updatedAt: now() };
    write(empresaId, { ...state, items: state.items.map(item => item.id === id ? updated : item) });
    return { ...updated };
  },

  async inactivateItem(empresaId: string, id: string): Promise<InventoryItem> {
    requireDemo();
    const state = read(empresaId);
    const current = findItem(state, empresaId, id);
    if (current.quantityReserved > 0) throw new InventoryServiceError("Cancele as reservas antes de inativar o item.");
    const updated: InventoryItem = { ...current, status: "INATIVO", updatedAt: now() };
    write(empresaId, { ...state, items: state.items.map(item => item.id === id ? updated : item) });
    return { ...updated };
  },

  async move(empresaId: string, itemId: string, operation: InventoryOperation, actor: InventoryActor): Promise<{ item: InventoryItem; movement: InventoryMovement }> {
    requireDemo();
    const state = read(empresaId);
    const item = findItem(state, empresaId, itemId);
    validateOperation(item, state, operation);
    const idempotencyKey = operation.idempotencyKey?.trim() || `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const repeated = state.movements.find(movement => movement.idempotencyKey === idempotencyKey && movement.empresaId === empresaId);
    if (repeated) return { item: { ...item }, movement: { ...repeated } };
    const at = now();
    const workOrder = operation.workOrderId ? await workOrderService.get(empresaId, operation.workOrderId) : undefined;
    const reservationConsumed = operation.type === "CONSUMO_OS" && operation.workOrderId
      ? Math.min(operation.quantity, Math.max(0, movementQuantity(state, operation.workOrderId, item.id, "RESERVA") - movementQuantity(state, operation.workOrderId, item.id, "CANCELAMENTO_RESERVA") - movementQuantity(state, operation.workOrderId, item.id, "CONSUMO_OS")))
      : 0;
    const updated = applyBalance(item, operation, reservationConsumed);
    const movement: InventoryMovement = {
      id: `inventory-movement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      empresaId,
      type: operation.type,
      itemId: item.id,
      itemCode: item.code,
      quantity: operation.quantity,
      unit: item.unit,
      source: operation.source,
      destination: operation.destination,
      workOrderId: workOrder?.id,
      workOrderNumber: workOrder?.number,
      userId: actor.id,
      userName: actor.name,
      reason: operation.reason.trim(),
      unitCost: item.averageCost,
      totalCost: item.averageCost == null ? undefined : Number((item.averageCost * operation.quantity).toFixed(2)),
      document: operation.document?.trim() || undefined,
      note: operation.note?.trim() || undefined,
      idempotencyKey,
      createdAt: at
    };
    if (workOrder && ["RESERVA", "CANCELAMENTO_RESERVA", "CONSUMO_OS", "DEVOLUCAO_OS"].includes(operation.type)) {
      await workOrderService.recordInventoryMovement(empresaId, workOrder.id, {
        movementId: movement.id,
        type: operation.type as "RESERVA" | "CANCELAMENTO_RESERVA" | "CONSUMO_OS" | "DEVOLUCAO_OS",
        itemId: item.id,
        itemCode: item.code,
        description: item.description,
        quantity: operation.quantity,
        unit: item.unit,
        unitCost: movement.unitCost,
        totalCost: movement.totalCost,
        at
      }, actor);
    }
    write(empresaId, { ...state, items: state.items.map(candidate => candidate.id === item.id ? updated : candidate), movements: [...state.movements, movement] });
    return { item: { ...updated }, movement: { ...movement } };
  },

  async createTool(empresaId: string, draft: ToolDraft, actor: InventoryActor): Promise<InventoryTool> {
    requireDemo();
    const state = read(empresaId);
    const code = normalize(draft.code);
    if (!code.startsWith(TOOL_PREFIX)) throw new InventoryServiceError(`No modo demo, use o prefixo ${TOOL_PREFIX}.`);
    if (state.tools.some(tool => normalize(tool.code) === code)) throw new InventoryServiceError("Já existe uma ferramenta com este código nesta empresa.");
    if (!draft.description.trim() || !draft.location.trim()) throw new InventoryServiceError("Informe descrição e localização da ferramenta.");
    const at = now();
    const tool: InventoryTool = { ...draft, id: `demo-tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, empresaId, code, description: draft.description.trim(), condition: draft.condition.trim(), location: draft.location.trim(), status: "DISPONIVEL", createdAt: at, updatedAt: at, history: [{ id: `tool-event-${Date.now()}`, type: "CADASTRO", description: "Ferramenta cadastrada.", userId: actor.id, userName: actor.name, at }] };
    write(empresaId, { ...state, tools: [...state.tools, tool] });
    return { ...tool, history: tool.history.map(event => ({ ...event })) };
  },

  async borrowTool(empresaId: string, id: string, input: { loanedTo: string; dueAt: string; workOrderId?: string }, actor: InventoryActor): Promise<InventoryTool> {
    requireDemo();
    const state = read(empresaId);
    const current = findTool(state, empresaId, id);
    if (current.status !== "DISPONIVEL") throw new InventoryServiceError("Esta ferramenta não está disponível para empréstimo.");
    if (!input.loanedTo.trim() || !input.dueAt) throw new InventoryServiceError("Informe responsável e previsão de devolução.");
    const workOrder = input.workOrderId ? await workOrderService.get(empresaId, input.workOrderId) : undefined;
    const at = now();
    const updated: InventoryTool = { ...current, status: "EMPRESTADA", loanedTo: input.loanedTo.trim(), responsible: input.loanedTo.trim(), workOrderId: workOrder?.id, workOrderNumber: workOrder?.number, withdrawnAt: at, dueAt: input.dueAt, returnedAt: undefined, updatedAt: at, history: [...current.history, { id: `tool-event-${Date.now()}`, type: "EMPRESTIMO", description: `Emprestada para ${input.loanedTo.trim()}${workOrder ? ` na O.S. ${workOrder.number}` : ""}.`, userId: actor.id, userName: actor.name, at }] };
    if (workOrder) await workOrderService.recordToolEvent(empresaId, workOrder.id, { toolId: current.id, toolCode: current.code, action: "EMPRESTIMO", at }, actor);
    write(empresaId, { ...state, tools: state.tools.map(tool => tool.id === id ? updated : tool) });
    return { ...updated, history: updated.history.map(event => ({ ...event })) };
  },

  async returnTool(empresaId: string, id: string, condition: string, actor: InventoryActor): Promise<InventoryTool> {
    requireDemo();
    const state = read(empresaId);
    const current = findTool(state, empresaId, id);
    if (current.status !== "EMPRESTADA") throw new InventoryServiceError("A ferramenta não possui empréstimo em aberto.");
    if (!condition.trim()) throw new InventoryServiceError("Informe a condição da ferramenta na devolução.");
    const at = now();
    const updated: InventoryTool = { ...current, status: "DISPONIVEL", condition: condition.trim(), loanedTo: undefined, responsible: undefined, workOrderId: undefined, workOrderNumber: undefined, returnedAt: at, updatedAt: at, history: [...current.history, { id: `tool-event-${Date.now()}`, type: "DEVOLUCAO", description: `Devolvida em condição: ${condition.trim()}.`, userId: actor.id, userName: actor.name, at }] };
    if (current.workOrderId) await workOrderService.recordToolEvent(empresaId, current.workOrderId, { toolId: current.id, toolCode: current.code, action: "DEVOLUCAO", at }, actor);
    write(empresaId, { ...state, tools: state.tools.map(tool => tool.id === id ? updated : tool) });
    return { ...updated, history: updated.history.map(event => ({ ...event })) };
  },

  async cleanupQa(empresaId: string): Promise<{ items: number; tools: number; movements: number }> {
    requireDemo();
    const state = read(empresaId);
    const qaItemIds = new Set(state.items.filter(item => normalize(item.code).startsWith(ITEM_PREFIX)).map(item => item.id));
    const qaToolIds = new Set(state.tools.filter(tool => normalize(tool.code).startsWith(TOOL_PREFIX)).map(tool => tool.id));
    const next: InventoryState = {
      items: state.items.filter(item => !qaItemIds.has(item.id)),
      tools: state.tools.filter(tool => !qaToolIds.has(tool.id)),
      movements: state.movements.filter(movement => !qaItemIds.has(movement.itemId))
    };
    write(empresaId, next);
    return { items: state.items.length - next.items.length, tools: state.tools.length - next.tools.length, movements: state.movements.length - next.movements.length };
  }
};
