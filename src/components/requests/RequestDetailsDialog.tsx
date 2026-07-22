import { useState, type FormEvent } from "react";
import type { Asset } from "@/types/assets";
import {
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type MaintenanceRequest,
  type RequestStatus
} from "@/types/requests";

interface RequestDetailsDialogProps {
  request: MaintenanceRequest;
  asset?: Asset;
  canEdit: boolean;
  canReview: boolean;
  canCancel: boolean;
  onClose: () => void;
  onEdit: () => void;
  onTransition: (target: RequestStatus, reason?: string) => Promise<void>;
  onPrepareConversion: () => Promise<void>;
}

export function RequestDetailsDialog({
  request,
  asset,
  canEdit,
  canReview,
  canCancel,
  onClose,
  onEdit,
  onTransition,
  onPrepareConversion
}: RequestDetailsDialogProps) {
  const [showRejection, setShowRejection] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectionReason.trim()) {
      setRejectionError("Informe o motivo da rejeição.");
      return;
    }
    setRejectionError("");
    await onTransition("REJEITADA", rejectionReason);
    setShowRejection(false);
  }

  return (
    <div className="dialog-backdrop">
      <section className="dialog-card request-details" role="dialog" aria-modal="true" aria-labelledby="request-details-title">
        <header className="dialog-header">
          <div>
            <span className="request-number">{request.number}</span>
            <h2 id="request-details-title">{request.title}</h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar detalhes">Fechar</button>
        </header>

        <dl className="details-grid">
          <div><dt>Status</dt><dd>{REQUEST_STATUS_LABELS[request.status]}</dd></div>
          <div><dt>Prioridade</dt><dd>{REQUEST_PRIORITY_LABELS[request.priority]}</dd></div>
          <div><dt>Tipo</dt><dd>{REQUEST_TYPE_LABELS[request.type]}</dd></div>
          <div><dt>Solicitante</dt><dd>{request.requesterName}</dd></div>
          <div><dt>Ativo</dt><dd>{asset ? `${asset.tag} — ${asset.name}` : "Ativo não identificado"}</dd></div>
          <div><dt>Setor</dt><dd>{request.setorId || "Não informado"}</dd></div>
          <div><dt>Localização</dt><dd>{request.localId || "Não informada"}</dd></div>
          <div><dt>Abertura</dt><dd>{new Date(request.openedAt).toLocaleString("pt-BR")}</dd></div>
          <div className="details-wide"><dt>Descrição</dt><dd>{request.description}</dd></div>
          {request.rejectionReason ? (
            <div className="details-wide"><dt>Motivo da rejeição</dt><dd>{request.rejectionReason}</dd></div>
          ) : null}
          {request.conversionPreparedAt ? (
            <div className="details-wide"><dt>Conversão em O.S.</dt><dd>Preparada; aguardando integração com o módulo de Ordens de Serviço.</dd></div>
          ) : null}
        </dl>

        {showRejection ? (
          <form className="rejection-form" onSubmit={reject}>
            <label>
              Motivo da rejeição <span aria-hidden="true">*</span>
              <textarea
                value={rejectionReason}
                onChange={event => setRejectionReason(event.target.value)}
                rows={3}
                maxLength={500}
                autoFocus
              />
            </label>
            {rejectionError ? <div className="form-error" role="alert">{rejectionError}</div> : null}
            <div className="dialog-actions">
              <button className="btn ghost" type="button" onClick={() => setShowRejection(false)}>Voltar</button>
              <button className="btn danger" type="submit">Confirmar rejeição</button>
            </div>
          </form>
        ) : (
          <footer className="dialog-actions request-actions">
            {request.status === "ABERTA" && canEdit ? (
              <button className="btn ghost" type="button" onClick={onEdit}>Editar solicitação</button>
            ) : null}
            {request.status === "ABERTA" && canCancel ? (
              <button className="btn danger" type="button" onClick={() => onTransition("CANCELADA")}>Cancelar solicitação</button>
            ) : null}
            {request.status === "ABERTA" && canReview ? (
              <button className="btn primary" type="button" onClick={() => onTransition("EM_ANALISE")}>Mover para análise</button>
            ) : null}
            {request.status === "EM_ANALISE" && canReview ? (
              <>
                <button className="btn danger" type="button" onClick={() => setShowRejection(true)}>Rejeitar</button>
                <button className="btn primary" type="button" onClick={() => onTransition("APROVADA")}>Aprovar</button>
              </>
            ) : null}
            {request.status === "APROVADA" && canReview ? (
              <button
                className="btn primary"
                type="button"
                onClick={onPrepareConversion}
                disabled={Boolean(request.conversionPreparedAt)}
              >
                {request.conversionPreparedAt ? "Conversão preparada" : "Preparar conversão em O.S."}
              </button>
            ) : null}
          </footer>
        )}
      </section>
    </div>
  );
}
