import { useEffect, useState, type FormEvent } from "react";
import type { Asset } from "@/types/assets";
import { TRIGGER_TYPE_LABELS, type MaintenancePlan, type MaintenancePlanDraft, type MaintenanceTriggerType } from "@/types/pcm";

const empty: MaintenancePlanDraft = { code: "QA-AUTO-PCM-", assetId: "", name: "", description: "", maintenanceType: "PREVENTIVA", criticality: "MEDIA", defaultPriority: "MEDIA", triggerType: "CALENDARIO", frequency: 1, calendarUnit: "MES", startDate: "2026-07-22", advanceDays: 5, toleranceDays: 2, estimatedDurationMinutes: 60, procedure: "", instructions: "", plannedMaterials: [], plannedTools: [], checklist: [] };
function fromPlan(plan: MaintenancePlan): MaintenancePlanDraft { return { code: plan.code, assetId: plan.assetId, name: plan.name, description: plan.description, maintenanceType: plan.maintenanceType, criticality: plan.criticality, defaultPriority: plan.defaultPriority, triggerType: plan.triggerType, frequency: plan.frequency, calendarUnit: plan.calendarUnit, startDate: plan.startDate, advanceDays: plan.advanceDays, toleranceDays: plan.toleranceDays, meterCurrent: plan.meterCurrent, meterLimit: plan.meterLimit, estimatedDurationMinutes: plan.estimatedDurationMinutes, procedure: plan.procedure, instructions: plan.instructions, plannedMaterials: [...plan.plannedMaterials], plannedTools: [...plan.plannedTools], checklist: plan.checklist.map(item => ({ ...item })) }; }
export function MaintenancePlanFormDialog({ plan, assets, error, saving, onClose, onSave }: { plan: MaintenancePlan | null; assets: Asset[]; error: string; saving: boolean; onClose: () => void; onSave: (draft: MaintenancePlanDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<MaintenancePlanDraft>(() => plan ? fromPlan(plan) : empty);
  useEffect(() => { document.getElementById("pcm-code")?.focus(); }, []);
  const meter = ["HORIMETRO", "QUILOMETRAGEM", "CICLOS"].includes(draft.triggerType);
  async function submit(event: FormEvent) { event.preventDefault(); await onSave(draft); }
  return <div className="dialog-backdrop" role="presentation"><section className="dialog-card pcm-dialog" role="dialog" aria-modal="true" aria-labelledby="pcm-form-title">
    <header className="dialog-header"><div><h2 id="pcm-form-title">{plan ? "Editar plano de manutenção" : "Novo plano de manutenção"}</h2><p>Cadastre uma periodicidade clara e vinculada a um ativo.</p></div><button className="icon-button" type="button" aria-label="Fechar plano" onClick={onClose}>×</button></header>
    <form className="pcm-form" onSubmit={submit}>
      <label>Código do plano<input id="pcm-code" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} required /></label>
      <label>Ativo relacionado<select value={draft.assetId} onChange={e => setDraft({ ...draft, assetId: e.target.value })} required><option value="">Selecione o ativo</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.tag} — {asset.name}{asset.isActive ? "" : " (inativo)"}</option>)}</select></label>
      <label>Nome do plano<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required minLength={5} /></label>
      <label>Tipo<select value={draft.maintenanceType} onChange={e => setDraft({ ...draft, maintenanceType: e.target.value as MaintenancePlanDraft["maintenanceType"] })}><option value="PREVENTIVA">Preventiva</option><option value="PREDITIVA">Preditiva</option><option value="INSPECAO">Inspeção</option><option value="CALIBRACAO">Calibração</option><option value="LUBRIFICACAO">Lubrificação</option></select></label>
      <label className="form-field-wide">Descrição<textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} required minLength={10} rows={3} /></label>
      <label>Gatilho<select value={draft.triggerType} onChange={e => setDraft({ ...draft, triggerType: e.target.value as MaintenanceTriggerType })}>{Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Frequência<input type="number" min="1" value={draft.frequency} onChange={e => setDraft({ ...draft, frequency: Number(e.target.value) })} required /></label>
      {draft.triggerType === "CALENDARIO" ? <label>Unidade do calendário<select value={draft.calendarUnit} onChange={e => setDraft({ ...draft, calendarUnit: e.target.value as MaintenancePlanDraft["calendarUnit"] })}><option value="DIA">Dia(s)</option><option value="SEMANA">Semana(s)</option><option value="MES">Mês(es)</option><option value="ANO">Ano(s)</option></select></label> : null}
      <label>Data inicial<input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} required /></label>
      {meter ? <><label>Leitura atual<input type="number" min="0" value={draft.meterCurrent ?? 0} onChange={e => setDraft({ ...draft, meterCurrent: Number(e.target.value) })} /></label><label>Próximo limite<input type="number" min="1" value={draft.meterLimit ?? ""} onChange={e => setDraft({ ...draft, meterLimit: Number(e.target.value) })} required /></label></> : null}
      <label>Duração prevista (minutos)<input type="number" min="1" value={draft.estimatedDurationMinutes} onChange={e => setDraft({ ...draft, estimatedDurationMinutes: Number(e.target.value) })} required /></label>
      <label>Prioridade padrão<select value={draft.defaultPriority} onChange={e => setDraft({ ...draft, defaultPriority: e.target.value as MaintenancePlanDraft["defaultPriority"] })}><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option><option value="CRITICA">Crítica</option></select></label>
      <label className="form-field-wide">Procedimento<textarea value={draft.procedure} onChange={e => setDraft({ ...draft, procedure: e.target.value })} required rows={4} /></label>
      <label className="form-field-wide">Instruções complementares<textarea value={draft.instructions ?? ""} onChange={e => setDraft({ ...draft, instructions: e.target.value })} rows={2} /></label>
      {error ? <div className="error-message form-field-wide" role="alert">{error}</div> : null}
      <div className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit" disabled={saving}>{saving ? "Salvando..." : plan ? "Salvar alterações" : "Criar plano"}</button></div>
    </form>
  </section></div>;
}
