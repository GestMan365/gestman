import { assetService } from "@/services/assetService";
import { isDemoAuthMode } from "@/services/supabaseClient";
import type { MaintenanceRequest, RequestDraft, RequestStatus } from "@/types/requests";

const QA_PREFIX = "QA-AUTO-SOL";
const STORAGE_PREFIX = "gestman365.demo.requests";
const SEED_VERSION = "1";

const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  ABERTA: ["EM_ANALISE", "CANCELADA"],
  EM_ANALISE: ["APROVADA", "REJEITADA"],
  APROVADA: ["CONVERTIDA_EM_OS"],
  REJEITADA: [],
  CONVERTIDA_EM_OS: [],
  CANCELADA: []
};

interface RequesterIdentity {
  id: string;
  name: string;
}

interface TransitionOptions {
  reason?: string;
  workOrderId?: string;
}

export class RequestServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestServiceError";
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

function createSeedRequests(empresaId: string): MaintenanceRequest[] {
  const createdAt = "2026-07-21T13:00:00.000Z";
  const common = {
    empresaId,
    plantaId: "planta-demo",
    channel: "WEB" as const,
    attachments: [] as string[],
    createdAt,
    updatedAt: createdAt,
    isCancelled: false
  };
  return [
    {
      ...common,
      id: "qa-auto-sol-001",
      number: "QA-AUTO-SOL-001",
      title: "Ruído anormal no motor da esteira",
      description: "Motor da esteira apresenta ruído anormal durante a produção.",
      type: "CORRETIVA",
      priority: "ALTA",
      status: "ABERTA",
      requesterId: "demo-admin",
      requesterName: "Administrador",
      assetId: "qa-auto-ativo-mot-001",
      setorId: "Produção",
      localId: "Linha de produção 01",
      openedAt: createdAt
    },
    {
      ...common,
      id: "qa-auto-sol-002",
      number: "QA-AUTO-SOL-002",
      title: "Vazamento na bomba de processo",
      description: "Foi identificado vazamento próximo ao selo da bomba de processo.",
      type: "CORRETIVA",
      priority: "MEDIA",
      status: "EM_ANALISE",
      requesterId: "usuario-producao-qa",
      requesterName: "Operador de Produção QA",
      assetId: "qa-auto-ativo-bom-001",
      setorId: "Envase",
      localId: "Sala de bombas",
      openedAt: createdAt
    },
    {
      ...common,
      id: "qa-auto-sol-003",
      number: "QA-AUTO-SOL-003",
      title: "Queda de pressão no compressor",
      description: "A rede de ar comprimido apresenta queda de pressão frequente.",
      type: "CORRETIVA",
      priority: "CRITICA",
      status: "APROVADA",
      requesterId: "lider-utilidades-qa",
      requesterName: "Líder de Utilidades QA",
      assetId: "qa-auto-ativo-cmp-001",
      setorId: "Utilidades",
      localId: "Casa de compressores",
      openedAt: createdAt,
      approvedAt: "2026-07-21T14:00:00.000Z"
    },
    {
      ...common,
      id: "qa-auto-sol-004",
      number: "QA-AUTO-SOL-004",
      title: "Solicitação sem ativo identificado",
      description: "Há uma vibração na linha, mas o equipamento exato ainda não foi identificado.",
      type: "INSPECAO",
      priority: "BAIXA",
      status: "ABERTA",
      requesterId: "demo-admin",
      requesterName: "Administrador",
      setorId: "Produção",
      localId: "Linha de produção 02",
      openedAt: createdAt
    }
  ];
}

function isRequest(value: unknown): value is MaintenanceRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MaintenanceRequest>;
  return Boolean(
    typeof candidate.id === "string" &&
    typeof candidate.empresaId === "string" &&
    typeof candidate.number === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.priority === "string" &&
    typeof candidate.requesterId === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.isCancelled === "boolean"
  );
}

function readRequests(empresaId: string): MaintenanceRequest[] {
  const storage = browserStorage();
  if (!storage) return createSeedRequests(empresaId);

  if (storage.getItem(seedKey(empresaId)) !== SEED_VERSION) {
    const seeded = createSeedRequests(empresaId);
    storage.setItem(storageKey(empresaId), JSON.stringify(seeded));
    storage.setItem(seedKey(empresaId), SEED_VERSION);
    return seeded;
  }

  const raw = storage.getItem(storageKey(empresaId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isRequest)) return parsed;
  } catch {
    // A session-only demo can recover without touching remote or production data.
  }

  const seeded = createSeedRequests(empresaId);
  storage.setItem(storageKey(empresaId), JSON.stringify(seeded));
  return seeded;
}

function writeRequests(empresaId: string, requests: MaintenanceRequest[]): void {
  browserStorage()?.setItem(storageKey(empresaId), JSON.stringify(requests));
}

function requireDemoMode(): void {
  if (!isDemoAuthMode) {
    throw new RequestServiceError(
      "O backend de Solicitações ainda não foi configurado para este ambiente. Nenhum dado remoto foi alterado."
    );
  }
}

async function validateDraft(empresaId: string, draft: RequestDraft): Promise<void> {
  if (draft.title.trim().length < 5) {
    throw new RequestServiceError("Informe um título com pelo menos 5 caracteres.");
  }
  if (draft.description.trim().length < 10) {
    throw new RequestServiceError("Descreva o problema com pelo menos 10 caracteres.");
  }
  if (!draft.assetId && !draft.sectorId?.trim()) {
    throw new RequestServiceError("Informe o setor quando o ativo não for conhecido.");
  }
  if (draft.assetId) {
    const assets = await assetService.list(empresaId);
    if (!assets.some(asset => asset.id === draft.assetId && asset.empresaId === empresaId)) {
      throw new RequestServiceError("O ativo selecionado não pertence à empresa ativa.");
    }
  }
}

function nextNumber(requests: MaintenanceRequest[]): string {
  const largest = requests.reduce((current, request) => {
    const match = request.number.match(/(\d+)$/);
    return Math.max(current, match ? Number(match[1]) : 0);
  }, 0);
  return `${QA_PREFIX}-${String(largest + 1).padStart(3, "0")}`;
}

export const requestService = {
  qaPrefix: QA_PREFIX,
  allowedTransitions: ALLOWED_TRANSITIONS,

  async list(empresaId: string): Promise<MaintenanceRequest[]> {
    requireDemoMode();
    return readRequests(empresaId).map(request => ({ ...request, attachments: [...request.attachments] }));
  },

  async create(empresaId: string, draft: RequestDraft, requester: RequesterIdentity): Promise<MaintenanceRequest> {
    requireDemoMode();
    await validateDraft(empresaId, draft);
    const requests = readRequests(empresaId);
    const now = new Date().toISOString();
    const request: MaintenanceRequest = {
      id: `demo-request-${Date.now()}`,
      empresaId,
      number: nextNumber(requests),
      title: draft.title.trim(),
      description: draft.description.trim(),
      type: draft.type,
      priority: draft.priority,
      status: "ABERTA",
      requesterId: requester.id,
      requesterName: requester.name,
      channel: "WEB",
      openedAt: now,
      createdAt: now,
      updatedAt: now,
      assetId: draft.assetId || undefined,
      setorId: draft.sectorId?.trim() || undefined,
      localId: draft.locationId?.trim() || undefined,
      attachments: [],
      isCancelled: false
    };
    writeRequests(empresaId, [...requests, request]);
    return { ...request, attachments: [] };
  },

  async update(empresaId: string, id: string, draft: RequestDraft): Promise<MaintenanceRequest> {
    requireDemoMode();
    await validateDraft(empresaId, draft);
    const requests = readRequests(empresaId);
    const current = requests.find(request => request.id === id && request.empresaId === empresaId);
    if (!current) throw new RequestServiceError("Solicitação não encontrada nesta empresa.");
    if (current.status !== "ABERTA") {
      throw new RequestServiceError("Somente solicitações abertas podem ter os dados principais editados.");
    }
    const updated: MaintenanceRequest = {
      ...current,
      title: draft.title.trim(),
      description: draft.description.trim(),
      type: draft.type,
      priority: draft.priority,
      assetId: draft.assetId || undefined,
      setorId: draft.sectorId?.trim() || undefined,
      localId: draft.locationId?.trim() || undefined,
      updatedAt: new Date().toISOString()
    };
    writeRequests(empresaId, requests.map(request => request.id === id ? updated : request));
    return { ...updated, attachments: [...updated.attachments] };
  },

  async transition(
    empresaId: string,
    id: string,
    target: RequestStatus,
    options: TransitionOptions = {}
  ): Promise<MaintenanceRequest> {
    requireDemoMode();
    const requests = readRequests(empresaId);
    const current = requests.find(request => request.id === id && request.empresaId === empresaId);
    if (!current) throw new RequestServiceError("Solicitação não encontrada nesta empresa.");
    if (!ALLOWED_TRANSITIONS[current.status].includes(target)) {
      throw new RequestServiceError(`Transição inválida de ${current.status} para ${target}.`);
    }
    if (target === "REJEITADA" && !options.reason?.trim()) {
      throw new RequestServiceError("Informe o motivo da rejeição.");
    }
    if (target === "CONVERTIDA_EM_OS" && !options.workOrderId?.trim()) {
      throw new RequestServiceError("A conversão exige uma Ordem de Serviço criada pelo módulo de O.S.");
    }
    if (target === "CONVERTIDA_EM_OS" && current.workOrderId) {
      throw new RequestServiceError("Esta solicitação já foi convertida em Ordem de Serviço.");
    }

    const now = new Date().toISOString();
    const updated: MaintenanceRequest = {
      ...current,
      status: target,
      updatedAt: now,
      approvedAt: target === "APROVADA" ? now : current.approvedAt,
      rejectedAt: target === "REJEITADA" ? now : current.rejectedAt,
      rejectionReason: target === "REJEITADA" ? options.reason?.trim() : current.rejectionReason,
      cancelledAt: target === "CANCELADA" ? now : current.cancelledAt,
      isCancelled: target === "CANCELADA" ? true : current.isCancelled,
      workOrderId: target === "CONVERTIDA_EM_OS" ? options.workOrderId?.trim() : current.workOrderId
    };
    writeRequests(empresaId, requests.map(request => request.id === id ? updated : request));
    return { ...updated, attachments: [...updated.attachments] };
  },

  async prepareConversion(empresaId: string, id: string): Promise<MaintenanceRequest> {
    requireDemoMode();
    const requests = readRequests(empresaId);
    const current = requests.find(request => request.id === id && request.empresaId === empresaId);
    if (!current) throw new RequestServiceError("Solicitação não encontrada nesta empresa.");
    if (current.status !== "APROVADA") {
      throw new RequestServiceError("Somente solicitações aprovadas podem preparar a conversão.");
    }
    if (current.conversionPreparedAt) {
      throw new RequestServiceError("A conversão desta solicitação já foi preparada.");
    }
    const now = new Date().toISOString();
    const updated = { ...current, conversionPreparedAt: now, updatedAt: now };
    writeRequests(empresaId, requests.map(request => request.id === id ? updated : request));
    return { ...updated, attachments: [...updated.attachments] };
  },

  async cleanupQaRequests(empresaId: string): Promise<number> {
    requireDemoMode();
    const requests = readRequests(empresaId);
    const retained = requests.filter(request => !request.number.startsWith(QA_PREFIX));
    writeRequests(empresaId, retained);
    return requests.length - retained.length;
  }
};
