import { useEffect, useState, type FormEvent } from "react";
import {
  ASSET_CRITICALITY_LABELS,
  ASSET_STATUS_LABELS,
  type Asset,
  type AssetCriticality,
  type AssetDraft,
  type AssetStatus
} from "@/types/assets";

interface AssetFormDialogProps {
  asset?: Asset | null;
  error?: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: AssetDraft) => Promise<void>;
}

const EMPTY_DRAFT: AssetDraft = {
  tag: "",
  name: "",
  description: "",
  category: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  sectorId: "",
  locationId: "",
  status: "OPERANDO",
  criticality: "MEDIA"
};

function draftFromAsset(asset?: Asset | null): AssetDraft {
  if (!asset) return { ...EMPTY_DRAFT };
  return {
    tag: asset.tag,
    name: asset.name,
    description: asset.description ?? "",
    category: asset.category ?? "",
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    serialNumber: asset.serialNumber ?? "",
    sectorId: asset.setorId ?? "",
    locationId: asset.localId ?? "",
    status: asset.status,
    criticality: asset.criticality
  };
}

export function AssetFormDialog({ asset, error, isSaving, onClose, onSave }: AssetFormDialogProps) {
  const [draft, setDraft] = useState<AssetDraft>(() => draftFromAsset(asset));

  useEffect(() => setDraft(draftFromAsset(asset)), [asset]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(draft);
  }

  return (
    <div className="dialog-backdrop">
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="asset-form-title">
        <header className="dialog-header">
          <div>
            <h2 id="asset-form-title">{asset ? "Editar ativo" : "Novo ativo"}</h2>
            <p>Cadastre somente as informações técnicas confirmadas.</p>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar formulário">Fechar</button>
        </header>

        <form className="asset-form" onSubmit={handleSubmit}>
          <label>
            TAG <span aria-hidden="true">*</span>
            <input
              value={draft.tag}
              onChange={event => setDraft(current => ({ ...current, tag: event.target.value }))}
              required
              maxLength={50}
              placeholder="Ex.: MOT-001"
              autoFocus
            />
          </label>
          <label>
            Nome <span aria-hidden="true">*</span>
            <input
              value={draft.name}
              onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
              required
              maxLength={120}
              placeholder="Nome do equipamento"
            />
          </label>
          <label>
            Categoria
            <input
              value={draft.category}
              onChange={event => setDraft(current => ({ ...current, category: event.target.value }))}
              maxLength={80}
              placeholder="Ex.: Motor elétrico"
            />
          </label>
          <label>
            Setor
            <select
              value={draft.sectorId}
              onChange={event => setDraft(current => ({ ...current, sectorId: event.target.value }))}
            >
              <option value="">Não informado</option>
              <option value="Produção">Produção</option>
              <option value="Envase">Envase</option>
              <option value="Utilidades">Utilidades</option>
              <option value="Manutenção">Manutenção</option>
            </select>
          </label>
          <label>
            Localização
            <input
              value={draft.locationId}
              onChange={event => setDraft(current => ({ ...current, locationId: event.target.value }))}
              maxLength={120}
              placeholder="Local de instalação"
            />
          </label>
          <label>
            Criticidade <span aria-hidden="true">*</span>
            <select
              value={draft.criticality}
              onChange={event => setDraft(current => ({ ...current, criticality: event.target.value as AssetCriticality }))}
              required
            >
              {Object.entries(ASSET_CRITICALITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Status <span aria-hidden="true">*</span>
            <select
              value={draft.status}
              onChange={event => setDraft(current => ({ ...current, status: event.target.value as AssetStatus }))}
              required
            >
              {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Fabricante
            <input
              value={draft.manufacturer}
              onChange={event => setDraft(current => ({ ...current, manufacturer: event.target.value }))}
              maxLength={80}
            />
          </label>
          <label>
            Modelo
            <input
              value={draft.model}
              onChange={event => setDraft(current => ({ ...current, model: event.target.value }))}
              maxLength={80}
            />
          </label>
          <label>
            Número de série
            <input
              value={draft.serialNumber}
              onChange={event => setDraft(current => ({ ...current, serialNumber: event.target.value }))}
              maxLength={80}
            />
          </label>
          <label className="form-field-wide">
            Descrição
            <textarea
              value={draft.description}
              onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
              maxLength={500}
              rows={3}
            />
          </label>

          {error ? <div className="form-error form-field-wide" role="alert">{error}</div> : null}

          <footer className="dialog-actions form-field-wide">
            <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
            <button className="btn primary" type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar ativo"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
