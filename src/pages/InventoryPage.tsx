import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { InventoryItemFormDialog } from "@/components/inventory/InventoryItemFormDialog";
import { InventoryMovementDialog } from "@/components/inventory/InventoryMovementDialog";
import { ToolDialog } from "@/components/inventory/ToolDialog";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useTenant } from "@/hooks/useTenant";
import { inventoryService } from "@/services/inventoryService";
import { isDemoAuthMode } from "@/services/supabaseClient";
import { workOrderService } from "@/services/workOrderService";
import { availableQuantity, MOVEMENT_LABELS, type InventoryItem, type InventoryItemDraft, type InventoryMovement, type InventoryMovementType, type InventoryOperation, type InventoryTool, type ToolDraft } from "@/types/inventory";
import type { WorkOrder } from "@/types/workOrders";

type Tab = "items" | "movements" | "tools";
type ToolMode = "create" | "borrow" | "return";
const ADMIN_TYPES: InventoryMovementType[] = ["ENTRADA", "SAIDA", "RESERVA", "CANCELAMENTO_RESERVA", "CONSUMO_OS", "DEVOLUCAO_OS", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "TRANSFERENCIA", "INVENTARIO", "BAIXA_POR_PERDA", "BAIXA_POR_VALIDADE"];

function message(error: unknown): string { return error instanceof Error ? error.message : "Não foi possível concluir a operação."; }
function money(value?: number): string { return value == null ? "Não informado" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function dateTime(value: string): string { return new Date(value).toLocaleString("pt-BR"); }

export function InventoryPage() {
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const { can } = usePermission();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [tools, setTools] = useState<InventoryTool[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [formItem, setFormItem] = useState<InventoryItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [toolDialog, setToolDialog] = useState<{ mode: ToolMode; tool?: InventoryTool } | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);

  const actor = { id: user?.id ?? "unknown", name: user?.name ?? "Usuário" };
  async function reload() {
    if (!activeTenant) return;
    const [state, orders] = await Promise.all([inventoryService.list(activeTenant.id), workOrderService.list(activeTenant.id)]);
    setItems(state.items); setMovements(state.movements); setTools(state.tools); setWorkOrders(orders);
  }
  useEffect(() => { let cancelled = false; setLoading(true); setPageError(""); if (!activeTenant) { setLoading(false); return; } Promise.all([inventoryService.list(activeTenant.id), workOrderService.list(activeTenant.id)]).then(([state, orders]) => { if (!cancelled) { setItems(state.items); setMovements(state.movements); setTools(state.tools); setWorkOrders(orders); } }).catch(error => { if (!cancelled) setPageError(message(error)); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [activeTenant]);

  const categories = useMemo(() => [...new Set(items.map(item => item.category))].sort(), [items]);
  const filteredItems = useMemo(() => { const term = search.trim().toLocaleLowerCase("pt-BR"); return items.filter(item => !term || [item.code, item.description, item.category, item.defaultLocation].some(value => value.toLocaleLowerCase("pt-BR").includes(term))).filter(item => !category || item.category === category).filter(item => !lowOnly || availableQuantity(item) <= item.minimumStock).sort((a, b) => a.code.localeCompare(b.code)); }, [category, items, lowOnly, search]);
  const lowStock = items.filter(item => item.status === "ATIVO" && availableQuantity(item) <= item.minimumStock).length;
  const reserved = items.reduce((sum, item) => sum + item.quantityReserved, 0);
  const loaned = tools.filter(tool => tool.status === "EMPRESTADA").length;
  const canManage = can("estoque:manage");
  const canExecute = can("estoque:execute");
  const canPlan = can("estoque:plan");
  const canApprove = can("estoque:approve");
  const movementTypes = canManage ? ADMIN_TYPES : canApprove ? ["RESERVA", "CANCELAMENTO_RESERVA", "CONSUMO_OS", "DEVOLUCAO_OS", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "INVENTARIO"] as InventoryMovementType[] : canPlan ? ["RESERVA", "CANCELAMENTO_RESERVA"] as InventoryMovementType[] : canExecute ? ["CONSUMO_OS", "DEVOLUCAO_OS"] as InventoryMovementType[] : [];

  async function saveItem(draft: InventoryItemDraft) { if (!activeTenant) return; setSaving(true); setDialogError(""); try { await (formItem ? inventoryService.updateItem(activeTenant.id, formItem.id, draft) : inventoryService.createItem(activeTenant.id, draft)); await reload(); setFormOpen(false); setFormItem(null); setFeedback(formItem ? "Item atualizado com sucesso." : "Item criado com sucesso."); } catch (error) { setDialogError(message(error)); } finally { setSaving(false); } }
  async function move(operation: InventoryOperation) { if (!activeTenant || !movementItem) return; setSaving(true); setDialogError(""); try { const result = await inventoryService.move(activeTenant.id, movementItem.id, operation, actor); await reload(); setMovementItem(null); setFeedback(`${MOVEMENT_LABELS[result.movement.type]} registrada com sucesso.`); } catch (error) { setDialogError(message(error)); } finally { setSaving(false); } }
  async function createTool(draft: ToolDraft) { if (!activeTenant) return; setSaving(true); setDialogError(""); try { await inventoryService.createTool(activeTenant.id, draft, actor); await reload(); setToolDialog(null); setFeedback("Ferramenta criada com sucesso."); } catch (error) { setDialogError(message(error)); } finally { setSaving(false); } }
  async function borrowTool(input: { loanedTo: string; dueAt: string; workOrderId?: string }) { if (!activeTenant || !toolDialog?.tool) return; setSaving(true); setDialogError(""); try { await inventoryService.borrowTool(activeTenant.id, toolDialog.tool.id, input, actor); await reload(); setToolDialog(null); setFeedback("Empréstimo registrado com sucesso."); } catch (error) { setDialogError(message(error)); } finally { setSaving(false); } }
  async function returnTool(condition: string) { if (!activeTenant || !toolDialog?.tool) return; setSaving(true); setDialogError(""); try { await inventoryService.returnTool(activeTenant.id, toolDialog.tool.id, condition, actor); await reload(); setToolDialog(null); setFeedback("Devolução registrada com sucesso."); } catch (error) { setDialogError(message(error)); } finally { setSaving(false); } }
  async function inactivate(item: InventoryItem) { if (!activeTenant || !window.confirm(`Inativar ${item.code}?`)) return; try { await inventoryService.inactivateItem(activeTenant.id, item.id); await reload(); setFeedback("Item inativado com histórico preservado."); } catch (error) { setPageError(message(error)); } }
  async function cleanup() { if (!activeTenant || !window.confirm("Remover somente itens, ferramentas e movimentos QA-AUTO desta sessão?")) return; try { const result = await inventoryService.cleanupQa(activeTenant.id); await reload(); setFeedback(`${result.items} item(ns), ${result.tools} ferramenta(s) e ${result.movements} movimento(s) QA removidos.`); } catch (error) { setPageError(message(error)); } }

  return <>
    <PageHeader title="Estoque, Materiais e Ferramentas" description="Controle saldos, reservas, consumo em O.S. e empréstimos com rastreabilidade por empresa." actions={<div className="page-actions">{isDemoAuthMode && canManage ? <button className="btn ghost" type="button" onClick={cleanup}>Limpar dados QA</button> : null}{can("estoque:create") ? <button className="btn primary" type="button" onClick={() => { setFormItem(null); setDialogError(""); setFormOpen(true); }}>Novo item</button> : null}</div>} />
    <section className="inventory-summary" aria-label="Resumo do estoque"><article><span>Itens ativos</span><strong>{items.filter(item => item.status === "ATIVO").length}</strong><small>cadastros disponíveis</small></article><article><span>Estoque baixo</span><strong>{lowStock}</strong><small>no mínimo ou abaixo</small></article><article><span>Quantidade reservada</span><strong>{reserved}</strong><small>para Ordens de Serviço</small></article><article><span>Ferramentas emprestadas</span><strong>{loaned}</strong><small>de {tools.length} cadastradas</small></article></section>
    <div className="inventory-tabs" role="tablist" aria-label="Visões de estoque"><button className={tab === "items" ? "active" : ""} role="tab" aria-selected={tab === "items"} onClick={() => setTab("items")}>Itens</button><button className={tab === "movements" ? "active" : ""} role="tab" aria-selected={tab === "movements"} onClick={() => setTab("movements")}>Movimentações</button><button className={tab === "tools" ? "active" : ""} role="tab" aria-selected={tab === "tools"} onClick={() => setTab("tools")}>Ferramentas</button></div>
    {feedback ? <div className="feedback-message" role="status">{feedback}</div> : null}{pageError ? <div className="error-message" role="alert">{pageError}</div> : null}{loading ? <p className="asset-state" role="status">Carregando estoque...</p> : null}
    {!loading && tab === "items" ? <section className="inventory-panel" aria-label="Itens de estoque"><div className="inventory-filters"><label className="inventory-search">Buscar item<input type="search" placeholder="Buscar por código, descrição, categoria ou local" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label className="inventory-check"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Somente estoque baixo</label><button className="btn ghost" type="button" onClick={() => { setSearch(""); setCategory(""); setLowOnly(false); }}>Limpar filtros</button></div><header className="asset-list-header"><div><h2>Itens e saldos</h2><p>{filteredItems.length} de {items.length} item(ns)</p></div>{isDemoAuthMode ? <span className="demo-badge">Dados demo QA-AUTO-EST</span> : null}</header>{filteredItems.length === 0 ? <p className="asset-state">Nenhum item encontrado para os filtros informados.</p> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Código / item</th><th>Categoria / local</th><th>Total</th><th>Reservado</th><th>Disponível</th><th>Custo médio</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filteredItems.map(item => <tr key={item.id}><td data-label="Código / item"><strong>{item.code}</strong><span>{item.description}</span></td><td data-label="Categoria / local"><strong>{item.category}</strong><span>{item.defaultLocation}</span></td><td data-label="Total">{item.quantityTotal} {item.unit}</td><td data-label="Reservado">{item.quantityReserved} {item.unit}</td><td data-label="Disponível"><strong className={availableQuantity(item) <= item.minimumStock ? "inventory-low" : ""}>{availableQuantity(item)} {item.unit}</strong></td><td data-label="Custo médio">{money(item.averageCost)}</td><td data-label="Status"><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status === "ATIVO" ? "Ativo" : "Inativo"}</span></td><td data-label="Ações"><div className="table-actions">{movementTypes.length && item.status === "ATIVO" ? <button className="btn ghost" type="button" aria-label={`Movimentar ${item.code}`} onClick={() => { setDialogError(""); setMovementItem(item); }}>Movimentar</button> : null}{can("estoque:edit") ? <button className="btn ghost" type="button" aria-label={`Editar ${item.code}`} onClick={() => { setFormItem(item); setDialogError(""); setFormOpen(true); }}>Editar</button> : null}{can("estoque:delete") && item.status === "ATIVO" ? <button className="btn danger" type="button" aria-label={`Inativar ${item.code}`} onClick={() => inactivate(item)}>Inativar</button> : null}</div></td></tr>)}</tbody></table></div>}</section> : null}
    {!loading && tab === "movements" ? <section className="inventory-panel" aria-label="Histórico de movimentações"><header className="asset-list-header"><div><h2>Histórico imutável</h2><p>{movements.length} movimentação(ões)</p></div></header><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th>Quantidade</th><th>O.S.</th><th>Usuário</th><th>Motivo</th><th>Custo</th></tr></thead><tbody>{[...movements].reverse().map(movement => <tr key={movement.id}><td data-label="Data">{dateTime(movement.createdAt)}</td><td data-label="Item"><strong>{movement.itemCode}</strong></td><td data-label="Tipo">{MOVEMENT_LABELS[movement.type]}</td><td data-label="Quantidade">{movement.quantity} {movement.unit}</td><td data-label="O.S.">{movement.workOrderNumber ?? "—"}</td><td data-label="Usuário">{movement.userName}</td><td data-label="Motivo">{movement.reason}</td><td data-label="Custo">{money(movement.totalCost)}</td></tr>)}</tbody></table></div></section> : null}
    {!loading && tab === "tools" ? <section className="inventory-panel" aria-label="Ferramentas controladas"><header className="asset-list-header"><div><h2>Ferramentas</h2><p>{tools.length} ferramenta(s)</p></div>{can("estoque:create") ? <button className="btn primary" type="button" onClick={() => { setDialogError(""); setToolDialog({ mode: "create" }); }}>Nova ferramenta</button> : null}</header><div className="tool-grid">{tools.map(tool => <article key={tool.id}><header><div><strong>{tool.code}</strong><p>{tool.description}</p></div><span className={`status-badge status-${tool.status.toLowerCase()}`}>{tool.status === "DISPONIVEL" ? "Disponível" : tool.status === "EMPRESTADA" ? "Emprestada" : "Inativa"}</span></header>{tool.status === "EMPRESTADA" && tool.dueAt && new Date(tool.dueAt).getTime() < Date.now() ? <div className="tool-overdue" role="alert">Devolução atrasada</div> : null}<dl><div><dt>Condição</dt><dd>{tool.condition}</dd></div><div><dt>Local</dt><dd>{tool.location}</dd></div>{tool.loanedTo ? <div><dt>Responsável</dt><dd>{tool.loanedTo}</dd></div> : null}{tool.workOrderNumber ? <div><dt>O.S.</dt><dd>{tool.workOrderNumber}</dd></div> : null}</dl><footer>{canExecute || canManage ? tool.status === "DISPONIVEL" ? <button className="btn ghost" type="button" aria-label={`Emprestar ${tool.code}`} onClick={() => { setDialogError(""); setToolDialog({ mode: "borrow", tool }); }}>Emprestar</button> : <button className="btn primary" type="button" aria-label={`Devolver ${tool.code}`} onClick={() => { setDialogError(""); setToolDialog({ mode: "return", tool }); }}>Devolver</button> : null}</footer></article>)}</div></section> : null}
    {formOpen ? <InventoryItemFormDialog item={formItem} error={dialogError} isSaving={saving} onClose={() => setFormOpen(false)} onSave={saveItem} /> : null}
    {movementItem ? <InventoryMovementDialog item={movementItem} workOrders={workOrders} allowedTypes={movementTypes} error={dialogError} isSaving={saving} onClose={() => setMovementItem(null)} onSave={move} /> : null}
    {toolDialog ? <ToolDialog mode={toolDialog.mode} tool={toolDialog.tool} workOrders={workOrders} error={dialogError} isSaving={saving} onClose={() => setToolDialog(null)} onCreate={createTool} onBorrow={borrowTool} onReturn={returnTool} /> : null}
  </>;
}
