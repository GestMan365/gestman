import { useEffect, useState, type FormEvent } from "react";
import type { Asset } from "@/types/assets";
import {
  REQUEST_PRIORITY_LABELS,
  REQUEST_TYPE_LABELS,
  type MaintenanceRequest,
  type RequestDraft,
  type RequestPriority,
  type RequestType
} from "@/types/requests";

interface RequestFormDialogProps {
  request?: MaintenanceRequest | null;
  assets: Asset[];
  error?: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: RequestDraft) => Promise<void>;
}

const EMPTY_DRAFT: RequestDraft = {
  title: "",
  description: "",
  type: "CORRETIVA",
  priority: "MEDIA",
  sectorId: "",
  locationId: "",
  assetId: ""
};

function draftFromRequest(request?: MaintenanceRequest | null): RequestDraft {
  if (!request) return { ...EMPTY_DRAFT };
  return {
    title: request.title,
    description: request.description,
    type: request.type,
    priority: request.priority,
    sectorId: request.setorId ?? "",
    locationId: request.localId ?? "",
    assetId: request.assetId ?? ""
  };
}

export function RequestFormDialog({ request, assets, error, isSaving, onClose, onSave }: RequestFormDialogProps) {
  const [draft, setDraft] = useState<RequestDraft>(() => draftFromRequest(request));

  useEffect(() => setDraft(draftFromRequest(request)), [request]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(draft);
  }

  function selectAsset(assetId: string) {
    const asset = assets.find(item => item.id === assetId);
    setDraft(current => ({
      ...current,
      assetId,
      sectorId: asset?.setorId ?? (assetId ? current.sectorId : ""),
      locationId: asset?.localId ?? (assetId ? current.locationId : "")
    }));
  }

  return (
    <div className="dialog-backdrop">
      <section className="dialog-card request-dialog" role="dialog" aria-modal="true" aria-labelledby="request-form-title">
        <header className="dialog-header">
          <div>
            <h2 id="request-form-title">{request ? "Editar solicitação" : "Nova solicitação"}</h2>
            <p>Conte o que aconteceu. A equipe de manutenção fará a análise técnica.</p>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar formulário">Fechar</button>
        </header>

        <form className="request-form" onSubmit={handleSubmit}>
          <label className="form-field-wide">
            O que aconteceu? <span aria-hidden="true">*</span>
            <input
              value={draft.title}
              onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
              required
              minLength={5}
              maxLength={120}
              placeholder="Ex.: Ruído diferente na máquina"
              autoFocus
            />
          </label>
          <label className="form-field-wide">
            Descreva o problema <span aria-hidden="true">*</span>
            <textarea
              value={draft.description}
              onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              placeholder="Explique quando começou, onde ocorre e o que você percebeu"
            />
          </label>
          <label>
            Ativo relacionado
            <select value={draft.assetId} onChange={event => selectAsset(event.target.value)}>
              <option value="">Não sei qual é o ativo</option>
              {assets.filter(asset => asset.isActive).map(asset => (
                <option key={asset.id} value={asset.id}>{asset.tag} — {asset.name}</option>
              ))}
            </select>
          </label>
          <label>
            Setor {!draft.assetId ? <span aria-hidden="true">*</span> : null}
            <select
              value={draft.sectorId}
              onChange={event => setDraft(current => ({ ...current, sectorId: event.target.value }))}
              required={!draft.assetId}
              disabled={Boolean(draft.assetId)}
            >
              <option value="">Selecione o setor</option>
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
              disabled={Boolean(draft.assetId)}
              placeholder="Onde o problema foi observado"
            />
          </label>
          <label>
            Prioridade <span aria-hidden="true">*</span>
            <select
              value={draft.priority}
              onChange={event => setDraft(current => ({ ...current, priority: event.target.value as RequestPriority }))}
              required
            >
              {Object.entries(REQUEST_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <small>Use Crítica somente quando houver risco imediato à segurança ou produção.</small>
          </label>
          <label>
            Tipo da solicitação <span aria-hidden="true">*</span>
            <select
              value={draft.type}
              onChange={event => setDraft(current => ({ ...current, type: event.target.value as RequestType }))}
              required
            >
              {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          {error ? <div className="form-error form-field-wide" role="alert">{error}</div> : null}

          <footer className="dialog-actions form-field-wide">
            <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
            <button className="btn primary" type="submit" disabled={isSaving}>
              {isSaving ? "Enviando..." : request ? "Salvar alterações" : "Enviar solicitação"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
