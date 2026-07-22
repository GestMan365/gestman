import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { WorkOrderDetailsDialog } from "@/components/work-orders/WorkOrderDetailsDialog";
import { WorkOrderFormDialog } from "@/components/work-orders/WorkOrderFormDialog";
import { PermissionGate } from "@/components/security/PermissionGate";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useTenant } from "@/hooks/useTenant";
import { assetService } from "@/services/assetService";
import { isDemoAuthMode } from "@/services/supabaseClient";
import { workOrderService } from "@/services/workOrderService";
import type { Asset } from "@/types/assets";
import { MAINTENANCE_TYPE_LABELS, WORK_ORDER_PRIORITY_LABELS, WORK_ORDER_STATUS_LABELS, type MaintenanceType, type WorkOrder, type WorkOrderDraft, type WorkOrderExecutionLog, type WorkOrderPlan, type WorkOrderPriority, type WorkOrderStatus } from "@/types/workOrders";

function message(error: unknown) { return error instanceof Error ? error.message : "Não foi possível concluir a operação."; }

export function WorkOrdersPage() {
  const { user } = useAuth(); const { activeTenant } = useTenant(); const { can } = usePermission();
  const [orders, setOrders] = useState<WorkOrder[]>([]); const [assets, setAssets] = useState<Asset[]>([]); const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(""); const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState(""); const [status, setStatus] = useState<WorkOrderStatus | "">(""); const [priority, setPriority] = useState<WorkOrderPriority | "">("");
  const [type, setType] = useState<MaintenanceType | "">(""); const [assetId, setAssetId] = useState(""); const [technician, setTechnician] = useState("");
  const [formOpen, setFormOpen] = useState(false); const [formOrder, setFormOrder] = useState<WorkOrder | null>(null); const [formError, setFormError] = useState(""); const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<WorkOrder | null>(null);
  const actor = { id: user?.id ?? "unknown", name: user?.name ?? "Usuário" };
  const canEdit = can("ordensServico:edit"); const canPlan = can("ordensServico:plan"); const canExecute = can("ordensServico:execute"); const canClose = can("ordensServico:close"); const canCancel = can("ordensServico:delete");

  useEffect(() => { let cancelled = false; if (!activeTenant) { setOrders([]); setAssets([]); setLoading(false); return; } setLoading(true); setPageError(""); Promise.all([workOrderService.list(activeTenant.id), assetService.list(activeTenant.id)]).then(([items, assetItems]) => { if (!cancelled) { setOrders(items); setAssets(assetItems); } }).catch(error => { if (!cancelled) setPageError(message(error)); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [activeTenant]);

  const visible = useMemo(() => orders.filter(order => user?.role === "TECNICO" ? order.technicianId === user.id : user?.role === "SOLICITANTE" ? order.requesterId === user.id : true), [orders, user]);
  const technicians = useMemo(() => [...new Set(visible.map(order => order.technicianName).filter(Boolean) as string[])].sort(), [visible]);
  const filtered = useMemo(() => { const query = search.trim().toLocaleLowerCase("pt-BR"); return visible.filter(order => !query || [order.number, order.title, order.description].some(value => value.toLocaleLowerCase("pt-BR").includes(query))).filter(order => !status || order.status === status).filter(order => !priority || order.priority === priority).filter(order => !type || order.maintenanceType === type).filter(order => !assetId || order.assetId === assetId).filter(order => !technician || order.technicianName === technician).sort((a, b) => a.number.localeCompare(b.number)); }, [assetId, priority, search, status, technician, type, visible]);
  function assetFor(order: WorkOrder) { return assets.find(asset => asset.id === order.assetId); }
  function update(updated: WorkOrder, text: string) { setOrders(current => current.map(item => item.id === updated.id ? updated : item)); setDetails(updated); setFeedback(text); setPageError(""); }
  async function action(operation: () => Promise<WorkOrder>, text: string) { try { update(await operation(), text); } catch (error) { setPageError(message(error)); throw error; } }
  async function save(draft: WorkOrderDraft) { if (!activeTenant) return; setSaving(true); setFormError(""); try { const saved = formOrder ? await workOrderService.update(activeTenant.id, formOrder.id, draft, actor) : await workOrderService.create(activeTenant.id, draft, actor); setOrders(current => formOrder ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]); setFormOpen(false); setFormOrder(null); setFeedback(formOrder ? "Ordem de Serviço atualizada com sucesso." : `${saved.number} criada com sucesso.`); } catch (error) { setFormError(message(error)); } finally { setSaving(false); } }
  async function cleanup() { if (!activeTenant || !window.confirm("Remover somente O.S. com prefixo QA-AUTO-OS?")) return; const count = await workOrderService.cleanupQaOrders(activeTenant.id); setOrders(current => current.filter(item => !item.number.startsWith(workOrderService.qaPrefix))); setFeedback(`${count} O.S. QA removida(s) desta sessão.`); }
  function clearFilters() { setSearch(""); setStatus(""); setPriority(""); setType(""); setAssetId(""); setTechnician(""); }

  return <>
    <PageHeader title="Ordens de Serviço" description="Planeje, atribua, execute, conclua tecnicamente e encerre cada manutenção com rastreabilidade." actions={<div className="page-actions">{isDemoAuthMode && can("ordensServico:manage") ? <button className="btn ghost" type="button" onClick={cleanup}>Limpar dados QA</button> : null}<PermissionGate permission="ordensServico:create"><button className="btn primary" type="button" onClick={() => { setFormOrder(null); setFormError(""); setFormOpen(true); }}>Nova O.S.</button></PermissionGate></div>} />
    <section className="work-order-filters" aria-label="Filtros de Ordens de Serviço">
      <label className="work-order-search">Buscar O.S.<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por número, título ou descrição" /></label>
      <label>Status<select value={status} onChange={event => setStatus(event.target.value as WorkOrderStatus | "")}><option value="">Todos os status</option>{Object.entries(WORK_ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Prioridade<select value={priority} onChange={event => setPriority(event.target.value as WorkOrderPriority | "")}><option value="">Todas as prioridades</option>{Object.entries(WORK_ORDER_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Tipo<select value={type} onChange={event => setType(event.target.value as MaintenanceType | "")}><option value="">Todos os tipos</option>{Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Ativo<select value={assetId} onChange={event => setAssetId(event.target.value)}><option value="">Todos os ativos</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.tag}</option>)}</select></label>
      {user?.role !== "TECNICO" && user?.role !== "SOLICITANTE" ? <label>Técnico<select value={technician} onChange={event => setTechnician(event.target.value)}><option value="">Todos os técnicos</option>{technicians.map(name => <option key={name}>{name}</option>)}</select></label> : null}
      <button className="btn ghost" type="button" onClick={clearFilters}>Limpar filtros</button>
    </section>
    {feedback ? <div className="feedback-message" role="status">{feedback}</div> : null}{pageError ? <div className="error-message" role="alert">{pageError}</div> : null}
    <section className="work-order-list-card" aria-labelledby="work-order-list-title"><header className="request-list-header"><div><h2 id="work-order-list-title">Backlog de Ordens de Serviço</h2><p>{filtered.length} de {visible.length} O.S.</p></div>{isDemoAuthMode ? <span className="demo-badge">Dados demo QA-AUTO</span> : null}</header>
      {loading ? <p className="request-state" role="status">Carregando Ordens de Serviço...</p> : null}{!loading && !pageError && filtered.length === 0 ? <p className="request-state">Nenhuma Ordem de Serviço encontrada para os filtros informados.</p> : null}
      {!loading && filtered.length ? <div className="work-order-table-wrap"><table className="work-order-table"><thead><tr><th>Número</th><th>Serviço</th><th>Ativo / setor</th><th>Tipo</th><th>Prioridade</th><th>Técnico</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtered.map(order => { const asset = assetFor(order); return <tr key={order.id}><td data-label="Número"><strong>{order.number}</strong>{order.sourceRequestNumber ? <span>{order.sourceRequestNumber}</span> : null}</td><td data-label="Serviço"><strong>{order.title}</strong><span>{order.description}</span></td><td data-label="Ativo / setor"><strong>{asset?.tag ?? "Sem ativo"}</strong><span>{order.sectorId || "Setor não informado"}</span></td><td data-label="Tipo"><span>{MAINTENANCE_TYPE_LABELS[order.maintenanceType]}</span></td><td data-label="Prioridade"><span className={`priority-badge priority-${order.priority.toLowerCase()}`}>{WORK_ORDER_PRIORITY_LABELS[order.priority]}</span></td><td data-label="Técnico"><span>{order.technicianName || "Não atribuído"}</span></td><td data-label="Status"><span className={`work-order-status status-${order.status.toLowerCase()}`}>{WORK_ORDER_STATUS_LABELS[order.status]}</span></td><td data-label="Ações"><button className="btn ghost" type="button" aria-label={`Ver detalhes de ${order.number}`} onClick={() => setDetails(order)}>Ver detalhes</button></td></tr>; })}</tbody></table></div> : null}
    </section>
    {formOpen ? <WorkOrderFormDialog order={formOrder} assets={assets} error={formError} isSaving={saving} onClose={() => setFormOpen(false)} onSave={save} /> : null}
    {details && activeTenant ? <WorkOrderDetailsDialog order={details} asset={assetFor(details)} canEdit={canEdit} canPlan={canPlan} canExecute={canExecute} canClose={canClose} canCancel={canCancel} onClose={() => setDetails(null)} onEdit={() => { setFormOrder(details); setFormError(""); setDetails(null); setFormOpen(true); }}
      onAnalyze={() => action(() => workOrderService.analyze(activeTenant.id, details.id, actor), "O.S. enviada para análise.")}
      onPlan={plan => action(() => workOrderService.plan(activeTenant.id, details.id, plan, actor), "Planejamento salvo.")}
      onWait={target => action(() => workOrderService.setWaiting(activeTenant.id, details.id, target, actor), "Status de espera registrado.")}
      onAssign={(id, name) => action(() => workOrderService.assign(activeTenant.id, details.id, id, name, actor), "Técnico atribuído.")}
      onStart={() => action(() => workOrderService.start(activeTenant.id, details.id, actor), "Execução iniciada.")}
      onPause={reason => action(() => workOrderService.pause(activeTenant.id, details.id, reason, actor), "Execução pausada.")}
      onResume={() => action(() => workOrderService.resume(activeTenant.id, details.id, actor), "Execução retomada.")}
      onLog={log => action(() => workOrderService.logExecution(activeTenant.id, details.id, log, actor), "Apontamento salvo.")}
      onConclude={() => action(() => workOrderService.conclude(activeTenant.id, details.id, actor), "Conclusão técnica registrada.")}
      onCloseOrder={() => action(() => workOrderService.close(activeTenant.id, details.id, actor), "O.S. encerrada.")}
      onCancel={reason => action(() => workOrderService.cancel(activeTenant.id, details.id, reason, actor), "O.S. cancelada.")}
      onReopen={reason => action(() => workOrderService.reopen(activeTenant.id, details.id, reason, actor), "O.S. reaberta para planejamento.")} /> : null}
  </>;
}
