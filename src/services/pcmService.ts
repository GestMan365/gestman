import { assetService } from "@/services/assetService";
import { isDemoAuthMode } from "@/services/supabaseClient";
import { workOrderService } from "@/services/workOrderService";
import type { MaintenancePlan, MaintenancePlanActor, MaintenancePlanDraft, MaintenancePlanHistoryEvent, MaintenancePlanStatus } from "@/types/pcm";
import type { WorkOrder } from "@/types/workOrders";

const QA_PREFIX = "QA-AUTO-PCM";
const STORAGE_PREFIX = "gestman365.demo.pcm";
const SEED_VERSION = "1";

export class PcmServiceError extends Error { constructor(message: string) { super(message); this.name = "PcmServiceError"; } }
function storage(): Storage | null { return typeof window === "undefined" ? null : window.sessionStorage; }
function key(empresaId: string) { return `${STORAGE_PREFIX}.${empresaId}`; }
function seedKey(empresaId: string) { return `${key(empresaId)}.seed-version`; }
function normalize(value: string) { return value.trim().toUpperCase(); }
function dateOnly(value: Date) { return value.toISOString().slice(0, 10); }
function today() { return dateOnly(new Date()); }
function history(type: MaintenancePlanHistoryEvent["type"], description: string, actor: MaintenancePlanActor, at = new Date().toISOString()): MaintenancePlanHistoryEvent {
  return { id: `pcm-event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, description, actorId: actor.id, actorName: actor.name, at };
}
const SYSTEM: MaintenancePlanActor = { id: "qa-seed", name: "Seed QA" };

export function calculateNextExecution(from: string, frequency: number, unit: MaintenancePlan["calendarUnit"]): string {
  const value = new Date(`${from}T12:00:00`);
  if (Number.isNaN(value.getTime()) || frequency <= 0) throw new PcmServiceError("Periodicidade inválida.");
  if (unit === "DIA") value.setDate(value.getDate() + frequency);
  else if (unit === "SEMANA") value.setDate(value.getDate() + frequency * 7);
  else if (unit === "MES") value.setMonth(value.getMonth() + frequency);
  else if (unit === "ANO") value.setFullYear(value.getFullYear() + frequency);
  else throw new PcmServiceError("Informe a unidade do calendário.");
  return dateOnly(value);
}

function seedPlan(empresaId: string, partial: Partial<MaintenancePlan> & Pick<MaintenancePlan, "id" | "assetId" | "code" | "name" | "description" | "triggerType" | "frequency" | "startDate" | "nextExecution" | "procedure">): MaintenancePlan {
  const createdAt = "2026-07-22T12:00:00.000Z";
  return {
    empresaId, maintenanceType: "PREVENTIVA", criticality: "ALTA", defaultPriority: "MEDIA", status: "ATIVO", version: 1,
    calendarUnit: "MES", advanceDays: 5, toleranceDays: 2, estimatedDurationMinutes: 60,
    plannedMaterials: [], plannedTools: [], checklistVersion: 1, checklist: [], generatedWorkOrderIds: [], createdAt, updatedAt: createdAt,
    history: [history("CRIACAO", "Plano criado pelo conjunto de dados QA.", SYSTEM, createdAt), history("ATIVACAO", "Plano ativado.", SYSTEM, createdAt)],
    ...partial
  };
}

function seeds(empresaId: string): MaintenancePlan[] {
  return [
    seedPlan(empresaId, { id: "qa-auto-pcm-mot-001", assetId: "qa-auto-ativo-mot-001", code: "QA-AUTO-PCM-MOT-001", name: "Inspeção preventiva mensal do motor", description: "Inspecionar condições mecânicas e elétricas do motor.", triggerType: "CALENDARIO", frequency: 1, calendarUnit: "MES", startDate: "2026-07-01", nextExecution: "2026-08-01", procedure: "Inspecionar ruído, vibração, temperatura e conexões.", plannedTools: ["Multímetro"], checklist: [{ id: "mot-1", description: "Verificar ruído anormal", required: true, answerType: "SIM_NAO", order: 1 }] }),
    seedPlan(empresaId, { id: "qa-auto-pcm-bom-001", assetId: "qa-auto-ativo-bom-001", code: "QA-AUTO-PCM-BOM-001", name: "Inspeção trimestral da bomba", description: "Inspecionar selo, alinhamento e vazamentos da bomba.", triggerType: "CALENDARIO", frequency: 3, calendarUnit: "MES", startDate: "2026-07-05", nextExecution: "2026-10-05", procedure: "Bloquear o equipamento e verificar o conjunto hidráulico.", estimatedDurationMinutes: 90 }),
    seedPlan(empresaId, { id: "qa-auto-pcm-cmp-001", assetId: "qa-auto-ativo-cmp-001", code: "QA-AUTO-PCM-CMP-001", name: "Manutenção do compressor por horímetro", description: "Realizar manutenção a cada 500 horas.", triggerType: "HORIMETRO", frequency: 500, calendarUnit: undefined, startDate: "2026-07-01", nextExecution: "2026-08-15", meterCurrent: 2500, meterLimit: 3000, meterUnit: "HORAS", procedure: "Verificar filtros, óleo, correias e vazamentos.", estimatedDurationMinutes: 120 }),
    seedPlan(empresaId, { id: "qa-auto-pcm-ins-001", assetId: "qa-auto-ativo-cmp-001", code: "QA-AUTO-PCM-INS-001", name: "Inspeção semanal de vazamentos", description: "Percorrer a rede e registrar vazamentos.", maintenanceType: "INSPECAO", criticality: "MEDIA", defaultPriority: "BAIXA", triggerType: "CALENDARIO", frequency: 1, calendarUnit: "SEMANA", startDate: "2026-07-20", nextExecution: "2026-07-27", procedure: "Inspecionar conexões e identificar perdas com etiqueta.", estimatedDurationMinutes: 45 })
  ];
}

function valid(value: unknown): value is MaintenancePlan {
  if (!value || typeof value !== "object") return false; const item = value as Partial<MaintenancePlan>;
  return typeof item.id === "string" && typeof item.empresaId === "string" && typeof item.code === "string" && typeof item.assetId === "string" && typeof item.status === "string" && Array.isArray(item.history) && Array.isArray(item.generatedWorkOrderIds);
}
function read(empresaId: string): MaintenancePlan[] {
  const target = storage(); if (!target) return seeds(empresaId);
  if (target.getItem(seedKey(empresaId)) !== SEED_VERSION) { const items = seeds(empresaId); write(empresaId, items); target.setItem(seedKey(empresaId), SEED_VERSION); return items; }
  try { const parsed: unknown = JSON.parse(target.getItem(key(empresaId)) ?? "[]"); if (Array.isArray(parsed) && parsed.every(valid)) return parsed; } catch { /* recover demo only */ }
  const items = seeds(empresaId); write(empresaId, items); return items;
}
function write(empresaId: string, items: MaintenancePlan[]) { storage()?.setItem(key(empresaId), JSON.stringify(items)); }
function requireDemo() { if (!isDemoAuthMode) throw new PcmServiceError("O backend de PCM ainda não foi configurado neste ambiente. Nenhum dado remoto foi alterado."); }
function copy(plan: MaintenancePlan): MaintenancePlan { return { ...plan, plannedMaterials: [...plan.plannedMaterials], plannedTools: [...plan.plannedTools], checklist: plan.checklist.map(item => ({ ...item })), generatedWorkOrderIds: [...plan.generatedWorkOrderIds], history: plan.history.map(item => ({ ...item })) }; }
function find(items: MaintenancePlan[], empresaId: string, id: string) { const plan = items.find(item => item.id === id && item.empresaId === empresaId); if (!plan) throw new PcmServiceError("Plano não encontrado nesta empresa."); return plan; }
async function validate(empresaId: string, draft: MaintenancePlanDraft, items: MaintenancePlan[], ignoreId?: string) {
  if (!normalize(draft.code).startsWith(QA_PREFIX)) throw new PcmServiceError(`No modo demo, use o prefixo ${QA_PREFIX}.`);
  if (items.some(item => item.id !== ignoreId && normalize(item.code) === normalize(draft.code))) throw new PcmServiceError("Já existe um plano com este código nesta empresa.");
  if (draft.name.trim().length < 5 || draft.description.trim().length < 10) throw new PcmServiceError("Informe nome e descrição completos.");
  if (!Number.isFinite(draft.frequency) || draft.frequency <= 0) throw new PcmServiceError("A frequência deve ser maior que zero.");
  if (!draft.startDate || Number.isNaN(new Date(`${draft.startDate}T12:00:00`).getTime())) throw new PcmServiceError("Informe uma data inicial válida.");
  if (draft.triggerType === "CALENDARIO" && !draft.calendarUnit) throw new PcmServiceError("Informe a unidade do calendário.");
  if (["HORIMETRO", "QUILOMETRAGEM", "CICLOS"].includes(draft.triggerType) && (!Number.isFinite(draft.meterLimit) || (draft.meterLimit ?? 0) <= (draft.meterCurrent ?? 0))) throw new PcmServiceError("O próximo limite deve ser maior que a leitura atual.");
  if (!Number.isFinite(draft.estimatedDurationMinutes) || draft.estimatedDurationMinutes <= 0) throw new PcmServiceError("A duração prevista deve ser maior que zero.");
  const asset = (await assetService.list(empresaId)).find(item => item.id === draft.assetId && item.empresaId === empresaId);
  if (!asset) throw new PcmServiceError("Selecione um ativo da empresa ativa.");
}
function nextFor(draft: MaintenancePlanDraft) { return draft.triggerType === "CALENDARIO" ? calculateNextExecution(draft.startDate, draft.frequency, draft.calendarUnit) : draft.startDate; }
function transition(empresaId: string, id: string, target: MaintenancePlanStatus, actor: MaintenancePlanActor, description: string, reason?: string) {
  const items = read(empresaId); const current = find(items, empresaId, id); const now = new Date().toISOString();
  const allowed: Record<MaintenancePlanStatus, MaintenancePlanStatus[]> = { RASCUNHO: ["ATIVO", "ARQUIVADO"], ATIVO: ["SUSPENSO", "VENCIDO", "ARQUIVADO"], SUSPENSO: ["ATIVO", "ARQUIVADO"], VENCIDO: ["ATIVO", "ARQUIVADO"], ARQUIVADO: [] };
  if (!allowed[current.status].includes(target)) throw new PcmServiceError(`Transição inválida de ${current.status} para ${target}.`);
  const eventType = target === "ATIVO" ? (current.status === "SUSPENSO" ? "REATIVACAO" : "ATIVACAO") : target === "SUSPENSO" ? "SUSPENSAO" : "ARQUIVAMENTO";
  const updated: MaintenancePlan = { ...current, status: target, updatedAt: now, suspensionReason: target === "SUSPENSO" ? reason : undefined, suspendedAt: target === "SUSPENSO" ? now : undefined, history: [...current.history, history(eventType, description, actor, now)] };
  write(empresaId, items.map(item => item.id === id ? updated : item)); return copy(updated);
}

export const pcmService = {
  qaPrefix: QA_PREFIX, demoStorageKey: key,
  async list(empresaId: string) { requireDemo(); return read(empresaId).filter(item => item.empresaId === empresaId).map(copy); },
  async create(empresaId: string, draft: MaintenancePlanDraft, actor: MaintenancePlanActor) { requireDemo(); const items = read(empresaId); await validate(empresaId, draft, items); const now = new Date().toISOString(); const plan: MaintenancePlan = { ...draft, id: `demo-pcm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, empresaId, code: normalize(draft.code), name: draft.name.trim(), description: draft.description.trim(), procedure: draft.procedure.trim(), status: "RASCUNHO", version: 1, nextExecution: nextFor(draft), checklistVersion: 1, generatedWorkOrderIds: [], createdAt: now, updatedAt: now, history: [history("CRIACAO", "Plano criado em rascunho.", actor, now)] }; write(empresaId, [...items, plan]); return copy(plan); },
  async update(empresaId: string, id: string, draft: MaintenancePlanDraft, actor: MaintenancePlanActor) { requireDemo(); const items = read(empresaId); const current = find(items, empresaId, id); if (current.status === "ARQUIVADO") throw new PcmServiceError("Plano arquivado não pode ser editado."); await validate(empresaId, draft, items, id); const now = new Date().toISOString(); const periodicityChanged = current.triggerType !== draft.triggerType || current.frequency !== draft.frequency || current.calendarUnit !== draft.calendarUnit; const updated: MaintenancePlan = { ...current, ...draft, code: normalize(draft.code), name: draft.name.trim(), description: draft.description.trim(), procedure: draft.procedure.trim(), nextExecution: periodicityChanged ? nextFor(draft) : current.nextExecution, version: periodicityChanged ? current.version + 1 : current.version, updatedAt: now, history: [...current.history, history("EDICAO", periodicityChanged ? "Plano editado com nova versão de periodicidade." : "Plano editado.", actor, now)] }; write(empresaId, items.map(item => item.id === id ? updated : item)); return copy(updated); },
  async activate(empresaId: string, id: string, actor: MaintenancePlanActor) { requireDemo(); const current = find(read(empresaId), empresaId, id); if (!current.procedure.trim() || current.frequency <= 0 || !current.assetId) throw new PcmServiceError("Complete ativo, periodicidade e procedimento antes de ativar."); const asset = (await assetService.list(empresaId)).find(item => item.id === current.assetId); if (!asset?.isActive) throw new PcmServiceError("Plano de ativo inativo não pode ser ativado."); return transition(empresaId, id, "ATIVO", actor, "Plano ativado após validação."); },
  async suspend(empresaId: string, id: string, reason: string, actor: MaintenancePlanActor) { requireDemo(); if (!reason.trim()) throw new PcmServiceError("Informe o motivo da suspensão."); return transition(empresaId, id, "SUSPENSO", actor, `Plano suspenso: ${reason.trim()}`, reason.trim()); },
  async reactivate(empresaId: string, id: string, actor: MaintenancePlanActor) { requireDemo(); return transition(empresaId, id, "ATIVO", actor, "Plano reativado após revisão."); },
  async archive(empresaId: string, id: string, actor: MaintenancePlanActor) { requireDemo(); return transition(empresaId, id, "ARQUIVADO", actor, "Plano arquivado com histórico preservado."); },
  async registerMeter(empresaId: string, id: string, value: number, actor: MaintenancePlanActor) { requireDemo(); const items = read(empresaId); const current = find(items, empresaId, id); if (!["HORIMETRO", "QUILOMETRAGEM", "CICLOS"].includes(current.triggerType)) throw new PcmServiceError("Este plano não utiliza contador."); if (!Number.isFinite(value) || value < (current.meterCurrent ?? 0)) throw new PcmServiceError("A nova leitura não pode ser menor que a anterior."); const now = new Date().toISOString(); const updated = { ...current, meterCurrent: value, updatedAt: now, history: [...current.history, history("LEITURA", `Leitura atualizada para ${value}.`, actor, now)] }; write(empresaId, items.map(item => item.id === id ? updated : item)); return copy(updated); },
  async generateWorkOrder(empresaId: string, id: string, actor: MaintenancePlanActor): Promise<{ plan: MaintenancePlan; order: WorkOrder; created: boolean }> { requireDemo(); const items = read(empresaId); const current = find(items, empresaId, id); if (current.status !== "ATIVO") throw new PcmServiceError("Somente plano ativo pode gerar O.S."); const asset = (await assetService.list(empresaId)).find(item => item.id === current.assetId); if (!asset?.isActive) throw new PcmServiceError("Ativo inativo não pode gerar O.S."); const result = await workOrderService.generateFromMaintenancePlan(empresaId, { planId: current.id, planCode: current.code, planVersion: current.version, competence: current.nextExecution, assetId: current.assetId, title: current.name, description: current.description, maintenanceType: current.maintenanceType, priority: current.defaultPriority, criticality: current.criticality, estimatedDurationMinutes: current.estimatedDurationMinutes, procedure: current.procedure, instructions: current.instructions, plannedMaterials: current.plannedMaterials, plannedTools: current.plannedTools, checklist: current.checklist.map(item => item.description) }, actor); if (!result.created) return { plan: copy(current), order: result.order, created: false }; const nextExecution = current.triggerType === "CALENDARIO" ? calculateNextExecution(current.nextExecution, current.frequency, current.calendarUnit) : current.nextExecution; const now = new Date().toISOString(); const updated = { ...current, lastExecution: current.nextExecution, nextExecution, generatedWorkOrderIds: [...current.generatedWorkOrderIds, result.order.id], updatedAt: now, history: [...current.history, history("GERACAO_OS", `O.S. ${result.order.number} gerada para ${current.nextExecution}.`, actor, now)] }; write(empresaId, items.map(item => item.id === id ? updated : item)); return { plan: copy(updated), order: result.order, created: true }; },
  async cleanupQaPlans(empresaId: string) { requireDemo(); const items = read(empresaId); const retained = items.filter(item => !normalize(item.code).startsWith(QA_PREFIX)); write(empresaId, retained); return items.length - retained.length; },
  isOverdue(plan: MaintenancePlan) { return plan.status === "ATIVO" && plan.nextExecution < today(); }
};
