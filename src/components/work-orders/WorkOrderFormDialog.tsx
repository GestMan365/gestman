import { useEffect, useState, type FormEvent } from "react";
import type { Asset } from "@/types/assets";
import { MAINTENANCE_TYPE_LABELS, WORK_ORDER_PRIORITY_LABELS, type MaintenanceType, type WorkOrder, type WorkOrderCriticality, type WorkOrderDraft, type WorkOrderPriority } from "@/types/workOrders";

interface Props { order?: WorkOrder | null; assets: Asset[]; error?: string; isSaving: boolean; onClose: () => void; onSave: (draft: WorkOrderDraft) => Promise<void>; }
const EMPTY_DRAFT: WorkOrderDraft = { title: "", description: "", maintenanceType: "CORRETIVA", priority: "MEDIA", criticality: "MEDIA", assetId: "", sectorId: "", locationId: "", symptom: "" };
function fromOrder(order?: WorkOrder | null): WorkOrderDraft { return order ? { title: order.title, description: order.description, maintenanceType: order.maintenanceType, priority: order.priority, criticality: order.criticality, assetId: order.assetId ?? "", sectorId: order.sectorId ?? "", locationId: order.locationId ?? "", symptom: order.symptom ?? "" } : { ...EMPTY_DRAFT }; }

export function WorkOrderFormDialog({ order, assets, error, isSaving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<WorkOrderDraft>(() => fromOrder(order));
  useEffect(() => setDraft(fromOrder(order)), [order]);
  function selectAsset(assetId: string) { const asset = assets.find(item => item.id === assetId); setDraft(current => ({ ...current, assetId, sectorId: asset?.setorId ?? (assetId ? current.sectorId : ""), locationId: asset?.localId ?? (assetId ? current.locationId : ""), criticality: asset?.criticality ?? current.criticality })); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await onSave(draft); }
  return <div className="dialog-backdrop"><section className="dialog-card work-order-dialog" role="dialog" aria-modal="true" aria-labelledby="work-order-form-title">
    <header className="dialog-header"><div><h2 id="work-order-form-title">{order ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}</h2><p>Registre a necessidade técnica. Planejamento e execução serão feitos nas etapas seguintes.</p></div><button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar formulário">Fechar</button></header>
    <form className="work-order-form" onSubmit={submit}>
      <label className="form-field-wide">Título <span aria-hidden="true">*</span><input autoFocus required minLength={5} maxLength={120} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Substituir rolamento do motor" /></label>
      <label className="form-field-wide">Descrição <span aria-hidden="true">*</span><textarea required minLength={10} maxLength={1200} rows={4} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="Descreva o serviço necessário" /></label>
      <label>Ativo relacionado<select value={draft.assetId} onChange={event => selectAsset(event.target.value)}><option value="">Serviço geral sem ativo</option>{assets.filter(asset => asset.isActive).map(asset => <option key={asset.id} value={asset.id}>{asset.tag} — {asset.name}</option>)}</select></label>
      <label>Setor {!draft.assetId ? <span aria-hidden="true">*</span> : null}<select required={!draft.assetId} disabled={Boolean(draft.assetId)} value={draft.sectorId} onChange={event => setDraft(current => ({ ...current, sectorId: event.target.value }))}><option value="">Selecione o setor</option>{["Produção", "Envase", "Utilidades", "Manutenção", "Almoxarifado", "Qualidade"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Localização<input disabled={Boolean(draft.assetId)} value={draft.locationId} onChange={event => setDraft(current => ({ ...current, locationId: event.target.value }))} placeholder="Local do serviço" /></label>
      <label>Tipo de manutenção <span aria-hidden="true">*</span><select required value={draft.maintenanceType} onChange={event => setDraft(current => ({ ...current, maintenanceType: event.target.value as MaintenanceType }))}>{Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Prioridade <span aria-hidden="true">*</span><select required value={draft.priority} onChange={event => setDraft(current => ({ ...current, priority: event.target.value as WorkOrderPriority }))}>{Object.entries(WORK_ORDER_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Criticidade <span aria-hidden="true">*</span><select required value={draft.criticality} onChange={event => setDraft(current => ({ ...current, criticality: event.target.value as WorkOrderCriticality }))}>{Object.entries(WORK_ORDER_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="form-field-wide">Sintoma observado<input value={draft.symptom} onChange={event => setDraft(current => ({ ...current, symptom: event.target.value }))} placeholder="Comportamento percebido antes da intervenção" /></label>
      {error ? <div className="form-error form-field-wide" role="alert">{error}</div> : null}
      <footer className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit" disabled={isSaving}>{isSaving ? "Salvando..." : order ? "Salvar alterações" : "Criar O.S."}</button></footer>
    </form>
  </section></div>;
}
