import { useMemo, useState, type FormEvent } from "react";
import type { InventoryItem, InventoryMovementType, InventoryOperation } from "@/types/inventory";
import { MOVEMENT_LABELS } from "@/types/inventory";
import type { WorkOrder } from "@/types/workOrders";

interface Props {
  item: InventoryItem;
  workOrders: WorkOrder[];
  allowedTypes: InventoryMovementType[];
  error?: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (operation: InventoryOperation) => Promise<void>;
}

export function InventoryMovementDialog({ item, workOrders, allowedTypes, error, isSaving, onClose, onSave }: Props) {
  const [type, setType] = useState<InventoryMovementType>(allowedTypes[0] ?? "ENTRADA");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [workOrderId, setWorkOrderId] = useState("");
  const [source, setSource] = useState(item.defaultLocation);
  const [destination, setDestination] = useState("");
  const needsOrder = ["RESERVA", "CANCELAMENTO_RESERVA", "CONSUMO_OS", "DEVOLUCAO_OS"].includes(type);
  const isTransfer = type === "TRANSFERENCIA";
  const orderOptions = useMemo(() => workOrders.filter(order => !["ENCERRADA", "CANCELADA"].includes(order.status)), [workOrders]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({ type, quantity, reason, workOrderId: needsOrder ? workOrderId : undefined, source: isTransfer ? source : undefined, destination: isTransfer ? destination : undefined });
  }
  return (
    <div className="dialog-backdrop">
      <section className="dialog-card inventory-operation-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-operation-title">
        <header className="dialog-header"><div><h2 id="inventory-operation-title">Movimentar {item.code}</h2><p>{item.description} · saldo total {item.quantityTotal} {item.unit} · reservado {item.quantityReserved} {item.unit}</p></div><button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar movimentação">Fechar</button></header>
        <form className="inventory-form" onSubmit={submit}>
          <label>Tipo de movimentação <span aria-hidden="true">*</span><select autoFocus required value={type} onChange={e => setType(e.target.value as InventoryMovementType)}>{allowedTypes.map(value => <option key={value} value={value}>{MOVEMENT_LABELS[value]}</option>)}</select></label>
          <label>{type === "INVENTARIO" ? "Quantidade contada" : "Quantidade"} <span aria-hidden="true">*</span><input type="number" min="0.01" step="0.01" required value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label>
          {needsOrder ? <label className="form-field-wide">Ordem de Serviço <span aria-hidden="true">*</span><select required value={workOrderId} onChange={e => setWorkOrderId(e.target.value)}><option value="">Selecione</option>{orderOptions.map(order => <option key={order.id} value={order.id}>{order.number} — {order.title}</option>)}</select></label> : null}
          {isTransfer ? <><label>Origem <span aria-hidden="true">*</span><input required value={source} onChange={e => setSource(e.target.value)} /></label><label>Destino <span aria-hidden="true">*</span><input required value={destination} onChange={e => setDestination(e.target.value)} /></label></> : null}
          <label className="form-field-wide">Motivo <span aria-hidden="true">*</span><textarea required rows={3} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Justifique a movimentação" /></label>
          {error ? <div className="form-error form-field-wide" role="alert">{error}</div> : null}
          <footer className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit" disabled={isSaving}>{isSaving ? "Registrando..." : "Registrar movimentação"}</button></footer>
        </form>
      </section>
    </div>
  );
}
