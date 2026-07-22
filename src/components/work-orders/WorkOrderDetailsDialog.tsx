import { useState, type FormEvent } from "react";
import type { Asset } from "@/types/assets";
import { MAINTENANCE_TYPE_LABELS, WORK_ORDER_PRIORITY_LABELS, WORK_ORDER_STATUS_LABELS, type WorkOrder, type WorkOrderExecutionLog, type WorkOrderPlan } from "@/types/workOrders";

type FormMode = "PLAN" | "ASSIGN" | "LOG" | "PAUSE" | "CANCEL" | "REOPEN" | null;
interface Props {
  order: WorkOrder; asset?: Asset; canEdit: boolean; canPlan: boolean; canExecute: boolean; canClose: boolean; canCancel: boolean;
  onClose: () => void; onEdit: () => void; onAnalyze: () => Promise<void>; onPlan: (plan: WorkOrderPlan) => Promise<void>;
  onWait: (target: "AGUARDANDO_MATERIAL" | "AGUARDANDO_LIBERACAO") => Promise<void>;
  onAssign: (technicianId: string, technicianName: string) => Promise<void>; onStart: () => Promise<void>;
  onPause: (reason: string) => Promise<void>; onResume: () => Promise<void>; onLog: (log: WorkOrderExecutionLog) => Promise<void>;
  onConclude: () => Promise<void>; onCloseOrder: () => Promise<void>; onCancel: (reason: string) => Promise<void>; onReopen: (reason: string) => Promise<void>;
}

export function WorkOrderDetailsDialog(props: Props) {
  const { order, asset } = props;
  const [mode, setMode] = useState<FormMode>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<WorkOrderPlan>({ plannedDate: "2026-07-22T09:00", estimatedDurationMinutes: 60, instructions: "", risks: "", safetyLocks: "" });
  const [log, setLog] = useState<WorkOrderExecutionLog>({ observation: "", actionTaken: "", workingMinutes: 0, downtimeMinutes: 0 });
  async function run(action: () => Promise<void>) { setError(""); try { await action(); setMode(null); setReason(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível concluir a ação."); } }
  async function submitReason(event: FormEvent) { event.preventDefault(); if (mode === "PAUSE") await run(() => props.onPause(reason)); if (mode === "CANCEL") await run(() => props.onCancel(reason)); if (mode === "REOPEN") await run(() => props.onReopen(reason)); }
  return <div className="dialog-backdrop"><section className="dialog-card work-order-details" role="dialog" aria-modal="true" aria-labelledby="work-order-details-title">
    <header className="dialog-header"><div><span className="request-number">{order.number}</span><h2 id="work-order-details-title">{order.title}</h2></div><button className="btn ghost" type="button" onClick={props.onClose} aria-label="Fechar detalhes">Fechar</button></header>
    <dl className="details-grid">
      <div><dt>Status</dt><dd>{WORK_ORDER_STATUS_LABELS[order.status]}</dd></div><div><dt>Prioridade</dt><dd>{WORK_ORDER_PRIORITY_LABELS[order.priority]}</dd></div>
      <div><dt>Tipo</dt><dd>{MAINTENANCE_TYPE_LABELS[order.maintenanceType]}</dd></div><div><dt>Criticidade</dt><dd>{WORK_ORDER_PRIORITY_LABELS[order.criticality]}</dd></div>
      <div><dt>Ativo</dt><dd>{asset ? `${asset.tag} — ${asset.name}` : "Serviço geral sem ativo"}</dd></div><div><dt>Setor</dt><dd>{order.sectorId || "Não informado"}</dd></div>
      <div><dt>Técnico</dt><dd>{order.technicianName || "Não atribuído"}</dd></div><div><dt>Origem</dt><dd>{order.sourceRequestNumber || "Abertura manual"}</dd></div>
      <div><dt>Prevista</dt><dd>{order.plannedDate || "Não planejada"}</dd></div><div><dt>Duração estimada</dt><dd>{order.estimatedDurationMinutes ? `${order.estimatedDurationMinutes} min` : "Não informada"}</dd></div>
      <div><dt>Tempo trabalhado</dt><dd>{order.workingMinutes} min</dd></div><div><dt>Tempo de parada</dt><dd>{order.downtimeMinutes} min</dd></div>
      <div className="details-wide"><dt>Descrição</dt><dd>{order.description}</dd></div>
      {order.symptom ? <div className="details-wide"><dt>Sintoma</dt><dd>{order.symptom}</dd></div> : null}
      {order.instructions ? <div className="details-wide"><dt>Instruções</dt><dd>{order.instructions}</dd></div> : null}
      {order.actionTaken ? <div className="details-wide"><dt>Ação executada</dt><dd>{order.actionTaken}</dd></div> : null}
      {order.pauseReason ? <div className="details-wide"><dt>Motivo da pausa</dt><dd>{order.pauseReason}</dd></div> : null}
      {order.cancelReason ? <div className="details-wide"><dt>Motivo do cancelamento</dt><dd>{order.cancelReason}</dd></div> : null}
      {order.reopenReason ? <div className="details-wide"><dt>Motivo da reabertura</dt><dd>{order.reopenReason}</dd></div> : null}
    </dl>

    <section className="work-order-history" aria-label="Histórico da Ordem de Serviço"><h3>Histórico</h3><ol>{order.history.map(item => <li key={item.id}><strong>{item.description}</strong><span>{item.actorName} · {new Date(item.at).toLocaleString("pt-BR")}</span></li>)}</ol></section>

    {mode === "PLAN" ? <form className="inline-action-form" onSubmit={event => { event.preventDefault(); void run(() => props.onPlan(plan)); }}>
      <h3>Planejar O.S.</h3><label>Data prevista <input type="datetime-local" required value={plan.plannedDate} onChange={event => setPlan(current => ({ ...current, plannedDate: event.target.value }))} /></label>
      <label>Duração estimada em minutos <input type="number" required min="1" value={plan.estimatedDurationMinutes} onChange={event => setPlan(current => ({ ...current, estimatedDurationMinutes: Number(event.target.value) }))} /></label>
      <label className="form-field-wide">Instruções <textarea value={plan.instructions} onChange={event => setPlan(current => ({ ...current, instructions: event.target.value }))} /></label>
      <label>Riscos <input value={plan.risks} onChange={event => setPlan(current => ({ ...current, risks: event.target.value }))} /></label><label>Bloqueios de segurança <input value={plan.safetyLocks} onChange={event => setPlan(current => ({ ...current, safetyLocks: event.target.value }))} /></label>
      <div className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={() => setMode(null)}>Voltar</button><button className="btn primary" type="submit">Salvar planejamento</button></div>
    </form> : null}
    {mode === "ASSIGN" ? <form className="inline-action-form" onSubmit={event => { event.preventDefault(); void run(() => props.onAssign("demo-admin", "Técnico QA")); }}><h3>Atribuir técnico</h3><label className="form-field-wide">Técnico ativo<select aria-label="Técnico ativo" defaultValue="demo-admin"><option value="demo-admin">Técnico QA</option></select></label><div className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={() => setMode(null)}>Voltar</button><button className="btn primary" type="submit">Confirmar atribuição</button></div></form> : null}
    {mode === "LOG" ? <form className="inline-action-form" onSubmit={event => { event.preventDefault(); void run(() => props.onLog(log)); }}><h3>Registrar execução</h3>
      <label className="form-field-wide">Observação<textarea value={log.observation} onChange={event => setLog(current => ({ ...current, observation: event.target.value }))} /></label>
      <label className="form-field-wide">Ação executada<textarea value={log.actionTaken} onChange={event => setLog(current => ({ ...current, actionTaken: event.target.value }))} /></label>
      <label>Tempo trabalhado (min)<input type="number" min="0" value={log.workingMinutes} onChange={event => setLog(current => ({ ...current, workingMinutes: Number(event.target.value) }))} /></label><label>Tempo de parada (min)<input type="number" min="0" value={log.downtimeMinutes} onChange={event => setLog(current => ({ ...current, downtimeMinutes: Number(event.target.value) }))} /></label>
      <div className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={() => setMode(null)}>Voltar</button><button className="btn primary" type="submit">Salvar apontamento</button></div>
    </form> : null}
    {mode === "PAUSE" || mode === "CANCEL" || mode === "REOPEN" ? <form className="inline-action-form" onSubmit={submitReason}><h3>{mode === "PAUSE" ? "Pausar execução" : mode === "CANCEL" ? "Cancelar O.S." : "Reabrir O.S."}</h3><label className="form-field-wide">Motivo <span aria-hidden="true">*</span><textarea autoFocus value={reason} onChange={event => setReason(event.target.value)} /></label><div className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={() => setMode(null)}>Voltar</button><button className={mode === "CANCEL" ? "btn danger" : "btn primary"} type="submit">Confirmar</button></div></form> : null}
    {error ? <div className="form-error" role="alert">{error}</div> : null}

    {!mode ? <footer className="dialog-actions work-order-actions">
      {order.status === "ABERTA" && props.canEdit ? <button className="btn ghost" type="button" onClick={props.onEdit}>Editar O.S.</button> : null}
      {order.status === "ABERTA" && props.canPlan ? <button className="btn primary" type="button" onClick={() => void run(props.onAnalyze)}>Enviar para análise</button> : null}
      {order.status === "EM_ANALISE" && props.canPlan ? <button className="btn primary" type="button" onClick={() => setMode("PLAN")}>Planejar O.S.</button> : null}
      {order.status === "PLANEJADA" && props.canPlan ? <><button className="btn ghost" type="button" onClick={() => void run(() => props.onWait("AGUARDANDO_MATERIAL"))}>Aguardar material</button><button className="btn ghost" type="button" onClick={() => void run(() => props.onWait("AGUARDANDO_LIBERACAO"))}>Aguardar liberação</button><button className="btn primary" type="button" onClick={() => setMode("ASSIGN")}>Atribuir técnico</button></> : null}
      {(order.status === "AGUARDANDO_MATERIAL" || order.status === "AGUARDANDO_LIBERACAO") && props.canPlan ? <button className="btn primary" type="button" onClick={() => setMode("ASSIGN")}>Liberar e atribuir</button> : null}
      {order.status === "ATRIBUIDA" && props.canExecute ? <button className="btn primary" type="button" onClick={() => void run(props.onStart)}>Iniciar execução</button> : null}
      {order.status === "EM_EXECUCAO" && props.canExecute ? <><button className="btn ghost" type="button" onClick={() => setMode("LOG")}>Registrar execução</button><button className="btn ghost" type="button" onClick={() => setMode("PAUSE")}>Pausar</button><button className="btn primary" type="button" onClick={() => void run(props.onConclude)}>Concluir tecnicamente</button></> : null}
      {order.status === "PAUSADA" && props.canExecute ? <><button className="btn ghost" type="button" onClick={() => setMode("LOG")}>Registrar execução</button><button className="btn primary" type="button" onClick={() => void run(props.onResume)}>Retomar execução</button></> : null}
      {order.status === "CONCLUIDA" && props.canClose ? <><button className="btn ghost" type="button" onClick={() => setMode("REOPEN")}>Reabrir O.S.</button><button className="btn primary" type="button" onClick={() => void run(props.onCloseOrder)}>Encerrar O.S.</button></> : null}
      {order.status === "ENCERRADA" && props.canClose ? <button className="btn ghost" type="button" onClick={() => setMode("REOPEN")}>Reabrir O.S.</button> : null}
      {["ABERTA", "EM_ANALISE", "PLANEJADA", "AGUARDANDO_MATERIAL", "AGUARDANDO_LIBERACAO", "ATRIBUIDA"].includes(order.status) && props.canCancel ? <button className="btn danger" type="button" onClick={() => setMode("CANCEL")}>Cancelar O.S.</button> : null}
    </footer> : null}
  </section></div>;
}
