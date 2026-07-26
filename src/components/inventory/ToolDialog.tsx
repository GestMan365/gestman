import { useState, type FormEvent } from "react";
import type { InventoryTool, ToolDraft } from "@/types/inventory";
import type { WorkOrder } from "@/types/workOrders";

interface Props {
  mode: "create" | "borrow" | "return";
  tool?: InventoryTool | null;
  workOrders: WorkOrder[];
  error?: string;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (draft: ToolDraft) => Promise<void>;
  onBorrow: (input: { loanedTo: string; dueAt: string; workOrderId?: string }) => Promise<void>;
  onReturn: (condition: string) => Promise<void>;
}

export function ToolDialog({ mode, tool, workOrders, error, isSaving, onClose, onCreate, onBorrow, onReturn }: Props) {
  const [code, setCode] = useState("QA-AUTO-FERR-");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState(tool?.condition ?? "Em boas condições");
  const [location, setLocation] = useState("");
  const [loanedTo, setLoanedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [workOrderId, setWorkOrderId] = useState("");
  const title = mode === "create" ? "Nova ferramenta" : mode === "borrow" ? `Emprestar ${tool?.code}` : `Devolver ${tool?.code}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "create") await onCreate({ code, description, condition, location });
    else if (mode === "borrow") await onBorrow({ loanedTo, dueAt, workOrderId: workOrderId || undefined });
    else await onReturn(condition);
  }
  return (
    <div className="dialog-backdrop">
      <section className="dialog-card inventory-operation-dialog" role="dialog" aria-modal="true" aria-labelledby="tool-dialog-title">
        <header className="dialog-header"><div><h2 id="tool-dialog-title">{title}</h2><p>O histórico da ferramenta será preservado.</p></div><button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar formulário de ferramenta">Fechar</button></header>
        <form className="inventory-form" onSubmit={submit}>
          {mode === "create" ? <>
            <label>Código <span aria-hidden="true">*</span><input autoFocus required value={code} onChange={e => setCode(e.target.value)} /></label>
            <label>Descrição <span aria-hidden="true">*</span><input required value={description} onChange={e => setDescription(e.target.value)} /></label>
            <label>Condição <span aria-hidden="true">*</span><input required value={condition} onChange={e => setCondition(e.target.value)} /></label>
            <label>Localização <span aria-hidden="true">*</span><input required value={location} onChange={e => setLocation(e.target.value)} /></label>
          </> : null}
          {mode === "borrow" ? <>
            <label>Responsável <span aria-hidden="true">*</span><input autoFocus required value={loanedTo} onChange={e => setLoanedTo(e.target.value)} /></label>
            <label>Previsão de devolução <span aria-hidden="true">*</span><input type="datetime-local" required value={dueAt} onChange={e => setDueAt(e.target.value)} /></label>
            <label className="form-field-wide">Ordem de Serviço<select value={workOrderId} onChange={e => setWorkOrderId(e.target.value)}><option value="">Sem vínculo com O.S.</option>{workOrders.filter(order => !["ENCERRADA", "CANCELADA"].includes(order.status)).map(order => <option key={order.id} value={order.id}>{order.number} — {order.title}</option>)}</select></label>
          </> : null}
          {mode === "return" ? <label className="form-field-wide">Condição na devolução <span aria-hidden="true">*</span><input autoFocus required value={condition} onChange={e => setCondition(e.target.value)} /></label> : null}
          {error ? <div className="form-error form-field-wide" role="alert">{error}</div> : null}
          <footer className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit" disabled={isSaving}>{isSaving ? "Salvando..." : mode === "borrow" ? "Confirmar empréstimo" : mode === "return" ? "Confirmar devolução" : "Salvar ferramenta"}</button></footer>
        </form>
      </section>
    </div>
  );
}
