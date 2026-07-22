import { assetService } from "@/services/assetService";
import { requestService } from "@/services/requestService";
import { isDemoAuthMode } from "@/services/supabaseClient";
import type { MaintenanceRequest } from "@/types/requests";
import type {
  WorkOrder,
  WorkOrderActor,
  WorkOrderDraft,
  WorkOrderExecutionLog,
  WorkOrderHistoryEvent,
  WorkOrderPlan,
  WorkOrderStatus
} from "@/types/workOrders";

const QA_PREFIX = "QA-AUTO-OS";
const STORAGE_PREFIX = "gestman365.demo.work-orders";
const SEED_VERSION = "1";

export const WORK_ORDER_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  ABERTA: ["EM_ANALISE", "CANCELADA"],
  EM_ANALISE: ["PLANEJADA", "CANCELADA"],
  PLANEJADA: ["ATRIBUIDA", "AGUARDANDO_MATERIAL", "AGUARDANDO_LIBERACAO", "CANCELADA"],
  AGUARDANDO_MATERIAL: ["ATRIBUIDA", "CANCELADA"],
  AGUARDANDO_LIBERACAO: ["ATRIBUIDA", "CANCELADA"],
  ATRIBUIDA: ["EM_EXECUCAO", "CANCELADA"],
  EM_EXECUCAO: ["PAUSADA", "CONCLUIDA"],
  PAUSADA: ["EM_EXECUCAO"],
  CONCLUIDA: ["ENCERRADA"],
  ENCERRADA: [],
  CANCELADA: []
};

export class WorkOrderServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkOrderServiceError";
  }
}

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function storageKey(empresaId: string): string {
  return `${STORAGE_PREFIX}.${empresaId}`;
}

function seedKey(empresaId: string): string {
  return `${storageKey(empresaId)}.seed-version`;
}

function event(type: WorkOrderHistoryEvent["type"], description: string, at: string, actor: WorkOrderActor): WorkOrderHistoryEvent {
  return {
    id: `event-${type.toLowerCase()}-${at}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    description,
    at,
    actorId: actor.id,
    actorName: actor.name
  };
}

const SYSTEM_ACTOR: WorkOrderActor = { id: "qa-seed", name: "Seed QA" };

function seedOrder(
  empresaId: string,
  number: string,
  draft: WorkOrderDraft,
  status: WorkOrderStatus,
  extras: Partial<WorkOrder> = {}
): WorkOrder {
  const createdAt = "2026-07-21T15:00:00.000Z";
  return {
    id: number.toLowerCase(),
    empresaId,
    plantaId: "planta-demo",
    number,
    title: draft.title,
    description: draft.description,
    maintenanceType: draft.maintenanceType,
    priority: draft.priority,
    criticality: draft.criticality,
    status,
    assetId: draft.assetId,
    sectorId: draft.sectorId,
    locationId: draft.locationId,
    symptom: draft.symptom,
    plannedMaterials: [],
    plannedTools: [],
    workingMinutes: 0,
    downtimeMinutes: 0,
    participants: [],
    usedMaterials: [],
    usedTools: [],
    observations: [],
    photos: [],
    attachments: [],
    checklist: [],
    measurements: [],
    followUpRequired: false,
    recurrence: false,
    createdAt,
    updatedAt: createdAt,
    isCancelled: false,
    history: [event("CRIACAO", "O.S. criada pelo conjunto de dados QA.", createdAt, SYSTEM_ACTOR)],
    ...extras
  };
}

function createSeedOrders(empresaId: string): WorkOrder[] {
  return [
    seedOrder(empresaId, "QA-AUTO-OS-001", {
      title: "Ruído anormal no motor da esteira",
      description: "Diagnosticar ruído anormal observado durante a produção.",
      maintenanceType: "CORRETIVA", priority: "ALTA", criticality: "ALTA",
      assetId: "qa-auto-ativo-mot-001", sectorId: "Produção", locationId: "Linha de produção 01",
      symptom: "Ruído acima do padrão"
    }, "ABERTA", { sourceRequestNumber: "QA-AUTO-SOL-001", requesterId: "demo-admin", requesterName: "Administrador" }),
    seedOrder(empresaId, "QA-AUTO-OS-002", {
      title: "Vazamento na bomba de processo",
      description: "Inspecionar selo e conexões da bomba de processo.",
      maintenanceType: "CORRETIVA", priority: "MEDIA", criticality: "ALTA",
      assetId: "qa-auto-ativo-bom-001", sectorId: "Envase", locationId: "Sala de bombas",
      symptom: "Vazamento próximo ao selo"
    }, "EM_ANALISE", { sourceRequestNumber: "QA-AUTO-SOL-002", requesterId: "usuario-producao-qa", requesterName: "Operador de Produção QA" }),
    seedOrder(empresaId, "QA-AUTO-OS-003", {
      title: "Queda de pressão no compressor",
      description: "Verificar causa da queda frequente de pressão na rede.",
      maintenanceType: "CORRETIVA", priority: "CRITICA", criticality: "CRITICA",
      assetId: "qa-auto-ativo-cmp-001", sectorId: "Utilidades", locationId: "Casa de compressores",
      symptom: "Pressão instável"
    }, "PLANEJADA", {
      sourceRequestNumber: "QA-AUTO-SOL-003", plannerId: "demo-admin",
      plannedDate: "2026-07-22T09:00", estimatedDurationMinutes: 120,
      instructions: "Inspecionar filtros, válvulas e pontos de vazamento."
    }),
    seedOrder(empresaId, "QA-AUTO-OS-004", {
      title: "Inspeção geral do motor elétrico",
      description: "Executar inspeção preventiva visual e funcional.",
      maintenanceType: "PREVENTIVA", priority: "MEDIA", criticality: "ALTA",
      assetId: "qa-auto-ativo-mot-001", sectorId: "Produção", locationId: "Linha de produção 01"
    }, "ATRIBUIDA", {
      technicianId: "demo-admin", technicianName: "Técnico QA",
      plannedDate: "2026-07-22T10:00", estimatedDurationMinutes: 60
    }),
    seedOrder(empresaId, "QA-AUTO-OS-005", {
      title: "Verificação de vazamentos na linha de ar",
      description: "Inspecionar conexões e mangueiras da linha de ar comprimido.",
      maintenanceType: "INSPECAO", priority: "BAIXA", criticality: "MEDIA",
      sectorId: "Utilidades", locationId: "Rede de ar comprimido"
    }, "EM_EXECUCAO", {
      technicianId: "demo-admin", technicianName: "Técnico QA",
      startedAt: "2026-07-21T16:00:00.000Z"
    })
  ];
}

function isWorkOrder(value: unknown): value is WorkOrder {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WorkOrder>;
  return Boolean(
    typeof item.id === "string" && typeof item.empresaId === "string" &&
    typeof item.number === "string" && typeof item.title === "string" &&
    typeof item.description === "string" && typeof item.status === "string" &&
    typeof item.createdAt === "string" && typeof item.updatedAt === "string" &&
    typeof item.workingMinutes === "number" && typeof item.downtimeMinutes === "number" &&
    Array.isArray(item.history) && Array.isArray(item.observations) &&
    Array.isArray(item.usedMaterials) && Array.isArray(item.attachments)
  );
}

function readOrders(empresaId: string): WorkOrder[] {
  const storage = browserStorage();
  if (!storage) return createSeedOrders(empresaId);
  if (storage.getItem(seedKey(empresaId)) !== SEED_VERSION) {
    const seeded = createSeedOrders(empresaId);
    storage.setItem(storageKey(empresaId), JSON.stringify(seeded));
    storage.setItem(seedKey(empresaId), SEED_VERSION);
    return seeded;
  }
  const raw = storage.getItem(storageKey(empresaId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isWorkOrder)) return parsed;
  } catch {
    // The demo session can safely recover without remote writes.
  }
  const seeded = createSeedOrders(empresaId);
  storage.setItem(storageKey(empresaId), JSON.stringify(seeded));
  return seeded;
}

function writeOrders(empresaId: string, orders: WorkOrder[]): void {
  browserStorage()?.setItem(storageKey(empresaId), JSON.stringify(orders));
}

function requireDemoMode(): void {
  if (!isDemoAuthMode) {
    throw new WorkOrderServiceError("O backend de Ordens de Serviço ainda não foi configurado neste ambiente. Nenhum dado remoto foi alterado.");
  }
}

function findOrder(orders: WorkOrder[], empresaId: string, id: string): WorkOrder {
  const order = orders.find(item => item.id === id && item.empresaId === empresaId);
  if (!order) throw new WorkOrderServiceError("Ordem de Serviço não encontrada nesta empresa.");
  return order;
}

function copyOrder(order: WorkOrder): WorkOrder {
  return {
    ...order,
    history: order.history.map(item => ({ ...item })),
    observations: [...order.observations], participants: [...order.participants],
    plannedMaterials: order.plannedMaterials.map(item => ({ ...item })),
    usedMaterials: order.usedMaterials.map(item => ({ ...item })),
    plannedTools: [...order.plannedTools], usedTools: [...order.usedTools],
    photos: [...order.photos], attachments: [...order.attachments],
    checklist: [...order.checklist], measurements: [...order.measurements]
  };
}

async function validateDraft(empresaId: string, draft: WorkOrderDraft): Promise<void> {
  if (draft.title.trim().length < 5) throw new WorkOrderServiceError("Informe um título com pelo menos 5 caracteres.");
  if (draft.description.trim().length < 10) throw new WorkOrderServiceError("Informe uma descrição com pelo menos 10 caracteres.");
  if (!draft.assetId && !draft.sectorId?.trim()) throw new WorkOrderServiceError("Informe o setor quando a O.S. não possuir ativo.");
  if (draft.assetId) {
    const assets = await assetService.list(empresaId);
    if (!assets.some(asset => asset.id === draft.assetId && asset.empresaId === empresaId)) {
      throw new WorkOrderServiceError("O ativo selecionado não pertence à empresa ativa.");
    }
  }
}

function nextNumber(orders: WorkOrder[]): string {
  const largest = orders.reduce((current, order) => {
    const match = order.number.match(/(\d+)$/);
    return Math.max(current, match ? Number(match[1]) : 0);
  }, 0);
  return `${QA_PREFIX}-${String(largest + 1).padStart(3, "0")}`;
}

function replaceOrder(empresaId: string, orders: WorkOrder[], updated: WorkOrder): WorkOrder {
  writeOrders(empresaId, orders.map(item => item.id === updated.id ? updated : item));
  return copyOrder(updated);
}

function transition(
  empresaId: string,
  id: string,
  target: WorkOrderStatus,
  actor: WorkOrderActor,
  description: string,
  mutate: Partial<WorkOrder> = {}
): WorkOrder {
  const orders = readOrders(empresaId);
  const current = findOrder(orders, empresaId, id);
  if (!WORK_ORDER_TRANSITIONS[current.status].includes(target)) {
    throw new WorkOrderServiceError(`Transição inválida de ${current.status} para ${target}.`);
  }
  const now = new Date().toISOString();
  return replaceOrder(empresaId, orders, {
    ...current, ...mutate, status: target, updatedAt: now,
    history: [...current.history, event("STATUS", description, now, actor)]
  });
}

export const workOrderService = {
  qaPrefix: QA_PREFIX,
  transitions: WORK_ORDER_TRANSITIONS,
  demoStorageKey: storageKey,

  async list(empresaId: string): Promise<WorkOrder[]> {
    requireDemoMode();
    return readOrders(empresaId).filter(order => order.empresaId === empresaId).map(copyOrder);
  },

  async create(empresaId: string, draft: WorkOrderDraft, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    await validateDraft(empresaId, draft);
    const orders = readOrders(empresaId);
    const now = new Date().toISOString();
    const number = nextNumber(orders);
    const order = seedOrder(empresaId, number, {
      ...draft,
      title: draft.title.trim(), description: draft.description.trim(),
      sectorId: draft.sectorId?.trim(), locationId: draft.locationId?.trim(), symptom: draft.symptom?.trim()
    }, "ABERTA", {
      id: `demo-work-order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now, updatedAt: now,
      history: [event("CRIACAO", "O.S. criada manualmente.", now, actor)]
    });
    writeOrders(empresaId, [...orders, order]);
    return copyOrder(order);
  },

  async update(empresaId: string, id: string, draft: WorkOrderDraft, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    await validateDraft(empresaId, draft);
    const orders = readOrders(empresaId);
    const current = findOrder(orders, empresaId, id);
    if (!["ABERTA", "EM_ANALISE"].includes(current.status)) {
      throw new WorkOrderServiceError("Campos principais só podem ser editados antes do planejamento.");
    }
    const now = new Date().toISOString();
    return replaceOrder(empresaId, orders, {
      ...current, ...draft,
      title: draft.title.trim(), description: draft.description.trim(),
      sectorId: draft.sectorId?.trim(), locationId: draft.locationId?.trim(), symptom: draft.symptom?.trim(),
      updatedAt: now,
      history: [...current.history, event("APONTAMENTO", "Dados principais atualizados.", now, actor)]
    });
  },

  async analyze(empresaId: string, id: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    return transition(empresaId, id, "EM_ANALISE", actor, "O.S. enviada para análise.");
  },

  async plan(empresaId: string, id: string, plan: WorkOrderPlan, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    if (!plan.plannedDate) throw new WorkOrderServiceError("Informe a data prevista.");
    if (!Number.isFinite(plan.estimatedDurationMinutes) || plan.estimatedDurationMinutes <= 0) {
      throw new WorkOrderServiceError("A duração estimada deve ser maior que zero.");
    }
    return transition(empresaId, id, "PLANEJADA", actor, "Planejamento registrado.", {
      ...plan, plannerId: actor.id,
      history: undefined
    });
  },

  async setWaiting(empresaId: string, id: string, target: "AGUARDANDO_MATERIAL" | "AGUARDANDO_LIBERACAO", actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    return transition(empresaId, id, target, actor, target === "AGUARDANDO_MATERIAL" ? "Aguardando material." : "Aguardando liberação operacional.");
  },

  async assign(empresaId: string, id: string, technicianId: string, technicianName: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    if (!technicianId.trim() || !technicianName.trim()) throw new WorkOrderServiceError("Selecione um técnico ativo para atribuir a O.S.");
    const assigned = transition(empresaId, id, "ATRIBUIDA", actor, `O.S. atribuída a ${technicianName}.`, {
      technicianId: technicianId.trim(), technicianName: technicianName.trim()
    });
    const orders = readOrders(empresaId);
    const current = findOrder(orders, empresaId, id);
    const now = new Date().toISOString();
    return replaceOrder(empresaId, orders, {
      ...current,
      history: [...current.history.slice(0, -1), event("ATRIBUICAO", `O.S. atribuída a ${technicianName}.`, now, actor)]
    }) ?? assigned;
  },

  async start(empresaId: string, id: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    const current = findOrder(readOrders(empresaId), empresaId, id);
    if (!current.technicianId) throw new WorkOrderServiceError("A O.S. precisa de um técnico antes do início.");
    const now = new Date().toISOString();
    return transition(empresaId, id, "EM_EXECUCAO", actor, "Execução iniciada.", { startedAt: current.startedAt ?? now });
  },

  async pause(empresaId: string, id: string, reason: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    if (!reason.trim()) throw new WorkOrderServiceError("Informe o motivo da pausa.");
    const now = new Date().toISOString();
    const paused = transition(empresaId, id, "PAUSADA", actor, `Execução pausada: ${reason.trim()}`, { pausedAt: now, pauseReason: reason.trim() });
    const orders = readOrders(empresaId);
    const current = findOrder(orders, empresaId, id);
    return replaceOrder(empresaId, orders, {
      ...current, history: [...current.history.slice(0, -1), event("PAUSA", `Execução pausada: ${reason.trim()}`, now, actor)]
    }) ?? paused;
  },

  async resume(empresaId: string, id: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    const now = new Date().toISOString();
    const resumed = transition(empresaId, id, "EM_EXECUCAO", actor, "Execução retomada.", { resumedAt: now });
    const orders = readOrders(empresaId);
    const current = findOrder(orders, empresaId, id);
    return replaceOrder(empresaId, orders, {
      ...current, history: [...current.history.slice(0, -1), event("RETOMADA", "Execução retomada.", now, actor)]
    }) ?? resumed;
  },

  async logExecution(empresaId: string, id: string, log: WorkOrderExecutionLog, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    const orders = readOrders(empresaId);
    const current = findOrder(orders, empresaId, id);
    if (!["EM_EXECUCAO", "PAUSADA"].includes(current.status)) throw new WorkOrderServiceError("Apontamentos exigem uma O.S. em execução ou pausada.");
    if (!Number.isFinite(log.workingMinutes) || log.workingMinutes < 0 || !Number.isFinite(log.downtimeMinutes) || log.downtimeMinutes < 0) {
      throw new WorkOrderServiceError("Tempo trabalhado e tempo de parada não podem ser negativos.");
    }
    if (!log.observation?.trim() && !log.actionTaken?.trim() && log.workingMinutes === 0 && log.downtimeMinutes === 0) {
      throw new WorkOrderServiceError("Registre ao menos uma observação, ação ou duração.");
    }
    const now = new Date().toISOString();
    const description = log.actionTaken?.trim() || log.observation?.trim() || "Tempo de execução registrado.";
    return replaceOrder(empresaId, orders, {
      ...current,
      observations: log.observation?.trim() ? [...current.observations, log.observation.trim()] : current.observations,
      actionTaken: log.actionTaken?.trim() || current.actionTaken,
      workingMinutes: current.workingMinutes + log.workingMinutes,
      downtimeMinutes: current.downtimeMinutes + log.downtimeMinutes,
      updatedAt: now,
      history: [...current.history, event("APONTAMENTO", description, now, actor)]
    });
  },

  async conclude(empresaId: string, id: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    const current = findOrder(readOrders(empresaId), empresaId, id);
    if (!current.actionTaken?.trim() || current.workingMinutes <= 0) {
      throw new WorkOrderServiceError("Registre a ação executada e o tempo trabalhado antes de concluir.");
    }
    const now = new Date().toISOString();
    return transition(empresaId, id, "CONCLUIDA", actor, "Conclusão técnica registrada.", { completedAt: now, completedBy: actor.id });
  },

  async close(empresaId: string, id: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    const now = new Date().toISOString();
    return transition(empresaId, id, "ENCERRADA", actor, "O.S. encerrada administrativamente.", { closedAt: now, closedBy: actor.id });
  },

  async cancel(empresaId: string, id: string, reason: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    if (!reason.trim()) throw new WorkOrderServiceError("Informe o motivo do cancelamento.");
    const now = new Date().toISOString();
    const cancelled = transition(empresaId, id, "CANCELADA", actor, `O.S. cancelada: ${reason.trim()}`, { cancelReason: reason.trim(), isCancelled: true });
    const orders = readOrders(empresaId);
    const current = findOrder(orders, empresaId, id);
    return replaceOrder(empresaId, orders, {
      ...current, history: [...current.history.slice(0, -1), event("CANCELAMENTO", `O.S. cancelada: ${reason.trim()}`, now, actor)]
    }) ?? cancelled;
  },

  async reopen(empresaId: string, id: string, reason: string, actor: WorkOrderActor): Promise<WorkOrder> {
    requireDemoMode();
    if (!reason.trim()) throw new WorkOrderServiceError("Informe o motivo da reabertura.");
    const orders = readOrders(empresaId);
    const current = findOrder(orders, empresaId, id);
    if (!["CONCLUIDA", "ENCERRADA"].includes(current.status)) throw new WorkOrderServiceError("Somente O.S. concluída ou encerrada pode ser reaberta.");
    const now = new Date().toISOString();
    return replaceOrder(empresaId, orders, {
      ...current, status: "PLANEJADA", reopenReason: reason.trim(), completedAt: undefined, closedAt: undefined,
      completedBy: undefined, closedBy: undefined, updatedAt: now,
      history: [...current.history, event("REABERTURA", `O.S. reaberta: ${reason.trim()}`, now, actor)]
    });
  },

  async convertApprovedRequest(empresaId: string, requestId: string, actor: WorkOrderActor): Promise<{ order: WorkOrder; request: MaintenanceRequest }> {
    requireDemoMode();
    const request = await requestService.getById(empresaId, requestId);
    if (!request) throw new WorkOrderServiceError("Solicitação não encontrada nesta empresa.");
    if (request.status !== "APROVADA") throw new WorkOrderServiceError("Somente solicitação aprovada pode gerar O.S.");
    const orders = readOrders(empresaId);
    if (request.workOrderId || orders.some(order => order.requestId === request.id)) {
      throw new WorkOrderServiceError("Esta solicitação já possui uma Ordem de Serviço.");
    }
    const number = nextNumber(orders);
    const now = new Date().toISOString();
    const order = seedOrder(empresaId, number, {
      title: request.title, description: request.description,
      maintenanceType: request.type === "INSPECAO" ? "INSPECAO" : request.type === "MELHORIA" ? "MELHORIA" : "CORRETIVA",
      priority: request.priority, criticality: request.priority,
      assetId: request.assetId, sectorId: request.setorId, locationId: request.localId
    }, "ABERTA", {
      id: `demo-work-order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      requestId: request.id, sourceRequestNumber: request.number,
      requesterId: request.requesterId, requesterName: request.requesterName,
      createdAt: now, updatedAt: now,
      history: [event("CRIACAO", `O.S. criada a partir da solicitação ${request.number}.`, now, actor)]
    });

    const storage = browserStorage();
    const orderKey = storageKey(empresaId);
    const requestKey = requestService.demoStorageKey(empresaId);
    const orderSnapshot = storage?.getItem(orderKey) ?? null;
    const requestSnapshot = storage?.getItem(requestKey) ?? null;
    try {
      const convertedRequest = await requestService.transition(empresaId, request.id, "CONVERTIDA_EM_OS", { workOrderId: order.id });
      writeOrders(empresaId, [...orders, order]);
      return { order: copyOrder(order), request: convertedRequest };
    } catch (error) {
      if (storage) {
        orderSnapshot === null ? storage.removeItem(orderKey) : storage.setItem(orderKey, orderSnapshot);
        requestSnapshot === null ? storage.removeItem(requestKey) : storage.setItem(requestKey, requestSnapshot);
      }
      throw error;
    }
  },

  async cleanupQaOrders(empresaId: string): Promise<number> {
    requireDemoMode();
    const orders = readOrders(empresaId);
    const retained = orders.filter(order => !order.number.startsWith(QA_PREFIX));
    writeOrders(empresaId, retained);
    return orders.length - retained.length;
  }
};
