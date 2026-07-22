import { useEffect, useMemo, useState } from "react";
import { RequestDetailsDialog } from "@/components/requests/RequestDetailsDialog";
import { RequestFormDialog } from "@/components/requests/RequestFormDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/security/PermissionGate";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useTenant } from "@/hooks/useTenant";
import { assetService } from "@/services/assetService";
import { requestService } from "@/services/requestService";
import { isDemoAuthMode } from "@/services/supabaseClient";
import type { Asset } from "@/types/assets";
import {
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  type MaintenanceRequest,
  type RequestDraft,
  type RequestPriority,
  type RequestStatus
} from "@/types/requests";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export function RequestsPage() {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const { can } = usePermission();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | "">("");
  const [requesterFilter, setRequesterFilter] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formRequest, setFormRequest] = useState<MaintenanceRequest | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<MaintenanceRequest | null>(null);

  const canEdit = can("solicitacoes:edit");
  const canReview = can("solicitacoes:approve");
  const canCancel = can("solicitacoes:delete");

  useEffect(() => {
    let cancelled = false;
    setPageError("");
    setFeedback("");
    if (!activeTenant) {
      setRequests([]);
      setAssets([]);
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    setIsLoading(true);
    Promise.all([
      requestService.list(activeTenant.id),
      assetService.list(activeTenant.id)
    ])
      .then(([requestItems, assetItems]) => {
        if (!cancelled) {
          setRequests(requestItems);
          setAssets(assetItems);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setRequests([]);
          setAssets([]);
          setPageError(errorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeTenant]);

  const visibleRequests = useMemo(() => {
    if (user?.role === "SOLICITANTE") {
      return requests.filter(request => request.requesterId === user.id);
    }
    return requests;
  }, [requests, user]);

  const requesters = useMemo(() => (
    [...new Set(visibleRequests.map(request => request.requesterName))].sort()
  ), [visibleRequests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return visibleRequests
      .filter(request => !normalizedSearch || [request.number, request.title, request.description]
        .some(value => value.toLocaleLowerCase("pt-BR").includes(normalizedSearch)))
      .filter(request => !statusFilter || request.status === statusFilter)
      .filter(request => !priorityFilter || request.priority === priorityFilter)
      .filter(request => !requesterFilter || request.requesterName === requesterFilter)
      .sort((left, right) => left.number.localeCompare(right.number));
  }, [priorityFilter, requesterFilter, search, statusFilter, visibleRequests]);

  function openCreateForm() {
    setFormRequest(null);
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditForm(request: MaintenanceRequest) {
    setDetailsRequest(null);
    setFormRequest(request);
    setFormError("");
    setIsFormOpen(true);
  }

  async function saveRequest(draft: RequestDraft) {
    if (!activeTenant || !user) return;
    setIsSaving(true);
    setFormError("");
    try {
      const saved = formRequest
        ? await requestService.update(activeTenant.id, formRequest.id, draft)
        : await requestService.create(activeTenant.id, draft, { id: user.id, name: user.name });
      setRequests(current => formRequest
        ? current.map(request => request.id === saved.id ? saved : request)
        : [...current, saved]);
      setIsFormOpen(false);
      setFormRequest(null);
      setFeedback(formRequest ? "Solicitação atualizada com sucesso." : `Solicitação ${saved.number} enviada com sucesso.`);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function transitionRequest(target: RequestStatus, reason?: string) {
    if (!activeTenant || !detailsRequest) return;
    if (target === "CANCELADA" && !window.confirm("Cancelar esta solicitação aberta?")) return;
    try {
      const updated = await requestService.transition(activeTenant.id, detailsRequest.id, target, { reason });
      setRequests(current => current.map(request => request.id === updated.id ? updated : request));
      setDetailsRequest(updated);
      const messages: Partial<Record<RequestStatus, string>> = {
        EM_ANALISE: "Solicitação movida para análise.",
        APROVADA: "Solicitação aprovada.",
        REJEITADA: "Solicitação rejeitada com o motivo registrado.",
        CANCELADA: "Solicitação cancelada."
      };
      setFeedback(messages[target] ?? "Status atualizado.");
      setPageError("");
    } catch (error) {
      setPageError(errorMessage(error));
    }
  }

  async function prepareConversion() {
    if (!activeTenant || !detailsRequest) return;
    try {
      const updated = await requestService.prepareConversion(activeTenant.id, detailsRequest.id);
      setRequests(current => current.map(request => request.id === updated.id ? updated : request));
      setDetailsRequest(updated);
      setFeedback("Conversão preparada. A O.S. será criada quando o módulo estiver integrado.");
      setPageError("");
    } catch (error) {
      setPageError(errorMessage(error));
    }
  }

  async function cleanupQa() {
    if (!activeTenant || !window.confirm("Remover somente as solicitações de teste com prefixo QA-AUTO-SOL?")) return;
    try {
      const removed = await requestService.cleanupQaRequests(activeTenant.id);
      setRequests(current => current.filter(request => !request.number.startsWith(requestService.qaPrefix)));
      setFeedback(`${removed} solicitação(ões) QA removida(s) desta sessão.`);
      setPageError("");
    } catch (error) {
      setPageError(errorMessage(error));
    }
  }

  function assetFor(request: MaintenanceRequest): Asset | undefined {
    return assets.find(asset => asset.id === request.assetId);
  }

  return (
    <>
      <PageHeader
        title="Solicitações"
        description="Informe uma necessidade de manutenção de forma simples e acompanhe o andamento da análise."
        actions={(
          <div className="page-actions">
            {isDemoAuthMode && canCancel ? (
              <button className="btn ghost" type="button" onClick={cleanupQa}>Limpar dados QA</button>
            ) : null}
            <PermissionGate permission="solicitacoes:create">
              <button className="btn primary" type="button" onClick={openCreateForm}>Nova solicitação</button>
            </PermissionGate>
          </div>
        )}
      />

      <section className="request-filters" aria-label="Filtros de solicitações">
        <label className="request-search">
          Buscar solicitação
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por número, título ou descrição"
          />
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as RequestStatus | "")}>
            <option value="">Todos os status</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Prioridade
          <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as RequestPriority | "")}>
            <option value="">Todas as prioridades</option>
            {Object.entries(REQUEST_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {user?.role !== "SOLICITANTE" ? (
          <label>
            Solicitante
            <select value={requesterFilter} onChange={event => setRequesterFilter(event.target.value)}>
              <option value="">Todos os solicitantes</option>
              {requesters.map(requester => <option key={requester} value={requester}>{requester}</option>)}
            </select>
          </label>
        ) : null}
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            setSearch("");
            setStatusFilter("");
            setPriorityFilter("");
            setRequesterFilter("");
          }}
        >
          Limpar filtros
        </button>
      </section>

      {feedback ? <div className="feedback-message" role="status">{feedback}</div> : null}
      {pageError ? <div className="error-message" role="alert">{pageError}</div> : null}

      <section className="request-list-card" aria-labelledby="request-list-title">
        <header className="request-list-header">
          <div>
            <h2 id="request-list-title">Lista de solicitações</h2>
            <p>{filteredRequests.length} de {visibleRequests.length} solicitação(ões)</p>
          </div>
          {isDemoAuthMode ? <span className="demo-badge">Dados demo QA-AUTO</span> : null}
        </header>

        {isLoading ? <p className="request-state" role="status">Carregando solicitações...</p> : null}
        {!isLoading && !pageError && filteredRequests.length === 0 ? (
          <p className="request-state">Nenhuma solicitação encontrada para os filtros informados.</p>
        ) : null}

        {!isLoading && filteredRequests.length > 0 ? (
          <div className="request-table-wrap">
            <table className="request-table">
              <thead>
                <tr>
                  <th scope="col">Número</th>
                  <th scope="col">Solicitação</th>
                  <th scope="col">Ativo / setor</th>
                  <th scope="col">Solicitante</th>
                  <th scope="col">Prioridade</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(request => {
                  const asset = assetFor(request);
                  return (
                    <tr key={request.id}>
                      <td data-label="Número"><strong>{request.number}</strong></td>
                      <td data-label="Solicitação">
                        <strong>{request.title}</strong>
                        <span>{request.description}</span>
                      </td>
                      <td data-label="Ativo / setor">
                        <strong>{asset ? asset.tag : "Ativo não identificado"}</strong>
                        <span>{request.setorId || "Setor não informado"}</span>
                      </td>
                      <td data-label="Solicitante"><span>{request.requesterName}</span></td>
                      <td data-label="Prioridade"><span className={`priority-badge priority-${request.priority.toLowerCase()}`}>{REQUEST_PRIORITY_LABELS[request.priority]}</span></td>
                      <td data-label="Status"><span className={`request-status request-status-${request.status.toLowerCase()}`}>{REQUEST_STATUS_LABELS[request.status]}</span></td>
                      <td data-label="Ações">
                        <button className="btn ghost" type="button" onClick={() => setDetailsRequest(request)} aria-label={`Ver detalhes de ${request.number}`}>
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {isFormOpen ? (
        <RequestFormDialog
          request={formRequest}
          assets={assets}
          error={formError}
          isSaving={isSaving}
          onClose={() => setIsFormOpen(false)}
          onSave={saveRequest}
        />
      ) : null}

      {detailsRequest ? (
        <RequestDetailsDialog
          request={detailsRequest}
          asset={assetFor(detailsRequest)}
          canEdit={canEdit}
          canReview={canReview}
          canCancel={canCancel}
          onClose={() => setDetailsRequest(null)}
          onEdit={() => openEditForm(detailsRequest)}
          onTransition={transitionRequest}
          onPrepareConversion={prepareConversion}
        />
      ) : null}
    </>
  );
}
