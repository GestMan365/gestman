import { useEffect, useState, type FormEvent } from "react";
import type { InventoryItem, InventoryItemDraft, InventoryUnit } from "@/types/inventory";

interface Props {
  item?: InventoryItem | null;
  error?: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: InventoryItemDraft) => Promise<void>;
}

const EMPTY: InventoryItemDraft = {
  code: "QA-AUTO-EST-",
  description: "",
  category: "",
  unit: "UN",
  minimumStock: 0,
  maximumStock: undefined,
  reorderPoint: 0,
  defaultLocation: "",
  averageCost: undefined,
  batchControlled: false,
  expiryControlled: false
};

function fromItem(item?: InventoryItem | null): InventoryItemDraft {
  if (!item) return { ...EMPTY };
  return {
    code: item.code,
    description: item.description,
    category: item.category,
    unit: item.unit,
    manufacturer: item.manufacturer,
    reference: item.reference,
    minimumStock: item.minimumStock,
    maximumStock: item.maximumStock,
    reorderPoint: item.reorderPoint,
    defaultLocation: item.defaultLocation,
    averageCost: item.averageCost,
    batchControlled: item.batchControlled,
    expiryControlled: item.expiryControlled,
    batch: item.batch,
    expiryDate: item.expiryDate
  };
}

export function InventoryItemFormDialog({ item, error, isSaving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<InventoryItemDraft>(() => fromItem(item));
  useEffect(() => setDraft(fromItem(item)), [item]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await onSave(draft); }
  const number = (value: string): number | undefined => value === "" ? undefined : Number(value);
  return (
    <div className="dialog-backdrop">
      <section className="dialog-card inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-item-title">
        <header className="dialog-header"><div><h2 id="inventory-item-title">{item ? "Editar item de estoque" : "Novo item de estoque"}</h2><p>Cadastre a identidade e os parâmetros de reposição. O saldo é alterado somente por movimentações.</p></div><button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar formulário de item">Fechar</button></header>
        <form className="inventory-form" onSubmit={submit}>
          <label>Código <span aria-hidden="true">*</span><input autoFocus required maxLength={50} value={draft.code} onChange={e => setDraft(v => ({ ...v, code: e.target.value }))} placeholder="QA-AUTO-EST-001" /></label>
          <label>Descrição <span aria-hidden="true">*</span><input required maxLength={120} value={draft.description} onChange={e => setDraft(v => ({ ...v, description: e.target.value }))} /></label>
          <label>Categoria <span aria-hidden="true">*</span><input required maxLength={80} value={draft.category} onChange={e => setDraft(v => ({ ...v, category: e.target.value }))} /></label>
          <label>Unidade <span aria-hidden="true">*</span><select required value={draft.unit} onChange={e => setDraft(v => ({ ...v, unit: e.target.value as InventoryUnit }))}>{["UN", "L", "KG", "M", "CX"].map(unit => <option key={unit}>{unit}</option>)}</select></label>
          <label>Fabricante<input maxLength={80} value={draft.manufacturer ?? ""} onChange={e => setDraft(v => ({ ...v, manufacturer: e.target.value }))} /></label>
          <label>Referência<input maxLength={80} value={draft.reference ?? ""} onChange={e => setDraft(v => ({ ...v, reference: e.target.value }))} /></label>
          <label>Estoque mínimo <span aria-hidden="true">*</span><input type="number" min="0" step="0.01" required value={draft.minimumStock} onChange={e => setDraft(v => ({ ...v, minimumStock: Number(e.target.value) }))} /></label>
          <label>Ponto de reposição <span aria-hidden="true">*</span><input type="number" min="0" step="0.01" required value={draft.reorderPoint} onChange={e => setDraft(v => ({ ...v, reorderPoint: Number(e.target.value) }))} /></label>
          <label>Estoque máximo<input type="number" min="0" step="0.01" value={draft.maximumStock ?? ""} onChange={e => setDraft(v => ({ ...v, maximumStock: number(e.target.value) }))} /></label>
          <label>Custo médio<input type="number" min="0" step="0.01" value={draft.averageCost ?? ""} onChange={e => setDraft(v => ({ ...v, averageCost: number(e.target.value) }))} /></label>
          <label className="form-field-wide">Localização padrão <span aria-hidden="true">*</span><input required maxLength={100} value={draft.defaultLocation} onChange={e => setDraft(v => ({ ...v, defaultLocation: e.target.value }))} /></label>
          <label className="inventory-check"><input type="checkbox" checked={draft.batchControlled} onChange={e => setDraft(v => ({ ...v, batchControlled: e.target.checked }))} /> Controlar lote</label>
          <label className="inventory-check"><input type="checkbox" checked={draft.expiryControlled} onChange={e => setDraft(v => ({ ...v, expiryControlled: e.target.checked }))} /> Controlar validade</label>
          {draft.expiryControlled ? <label>Validade <span aria-hidden="true">*</span><input type="date" required value={draft.expiryDate ?? ""} onChange={e => setDraft(v => ({ ...v, expiryDate: e.target.value }))} /></label> : null}
          {draft.batchControlled ? <label>Lote<input maxLength={50} value={draft.batch ?? ""} onChange={e => setDraft(v => ({ ...v, batch: e.target.value }))} /></label> : null}
          {error ? <div className="form-error form-field-wide" role="alert">{error}</div> : null}
          <footer className="dialog-actions form-field-wide"><button className="btn ghost" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar item"}</button></footer>
        </form>
      </section>
    </div>
  );
}
