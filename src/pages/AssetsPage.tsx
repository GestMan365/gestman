import { useEffect, useMemo, useState } from "react";
import { AssetDetailsDialog } from "@/components/assets/AssetDetailsDialog";
import { AssetFormDialog } from "@/components/assets/AssetFormDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/security/PermissionGate";
import { usePermission } from "@/hooks/usePermission";
import { useTenant } from "@/hooks/useTenant";
import { assetService } from "@/services/assetService";
import { isDemoAuthMode } from "@/services/supabaseClient";
import {
  ASSET_CRITICALITY_LABELS,
  ASSET_STATUS_LABELS,
  type Asset,
  type AssetCriticality,
  type AssetDraft,
  type AssetStatus
} from "@/types/assets";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export function AssetsPage() {
  const { activeTenant } = useTenant();
  const { can } = usePermission();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "">("");
  const [criticalityFilter, setCriticalityFilter] = useState<AssetCriticality | "">("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [formAsset, setFormAsset] = useState<Asset | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [detailsAsset, setDetailsAsset] = useState<Asset | null>(null);

  const canEdit = can("ativos:edit");
  const canDeleteQa = can("ativos:delete");

  useEffect(() => {
    let cancelled = false;
    setPageError("");
    setFeedback("");

    if (!activeTenant) {
      setAssets([]);
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    setIsLoading(true);
    assetService.list(activeTenant.id)
      .then(items => {
        if (!cancelled) setAssets(items);
      })
      .catch(error => {
        if (!cancelled) {
          setAssets([]);
          setPageError(errorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeTenant]);

  const sectors = useMemo(() => (
    [...new Set(assets.map(asset => asset.setorId).filter((value): value is string => Boolean(value)))].sort()
  ), [assets]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return assets
      .filter(asset => !normalizedSearch || [asset.tag, asset.name, asset.category, asset.localId]
        .filter(Boolean)
        .some(value => value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch)))
      .filter(asset => !statusFilter || asset.status === statusFilter)
      .filter(asset => !criticalityFilter || asset.criticality === criticalityFilter)
      .filter(asset => !sectorFilter || asset.setorId === sectorFilter)
      .sort((left, right) => left.tag.localeCompare(right.tag));
  }, [assets, criticalityFilter, search, sectorFilter, statusFilter]);

  function openCreateForm() {
    setFormAsset(null);
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditForm(asset: Asset) {
    setDetailsAsset(null);
    setFormAsset(asset);
    setFormError("");
    setIsFormOpen(true);
  }

  async function handleSave(draft: AssetDraft) {
    if (!activeTenant) return;
    setIsSaving(true);
    setFormError("");
    try {
      const saved = formAsset
        ? await assetService.update(activeTenant.id, formAsset.id, draft)
        : await assetService.create(activeTenant.id, draft);
      setAssets(current => formAsset
        ? current.map(asset => asset.id === saved.id ? saved : asset)
        : [...current, saved]);
      setIsFormOpen(false);
      setFormAsset(null);
      setFeedback(formAsset ? "Ativo atualizado com sucesso." : "Ativo criado com sucesso.");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleInactivate(asset: Asset) {
    if (!activeTenant) return;
    try {
      const updated = await assetService.inactivate(activeTenant.id, asset.id);
      setAssets(current => current.map(item => item.id === updated.id ? updated : item));
      setDetailsAsset(updated);
      setFeedback("Ativo inativado com sucesso.");
    } catch (error) {
      setPageError(errorMessage(error));
    }
  }

  async function handleCleanupQa() {
    if (!activeTenant || !window.confirm("Remover somente os ativos de teste com prefixo QA-AUTO-ATIVO?")) return;
    try {
      const removed = await assetService.cleanupQaAssets(activeTenant.id);
      setAssets(current => current.filter(asset => !asset.tag.startsWith(assetService.qaPrefix)));
      setFeedback(`${removed} ativo(s) QA removido(s) desta sessão.`);
    } catch (error) {
      setPageError(errorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        title="Ativos"
        description="Consulte e organize os equipamentos da empresa ativa com TAG, localização, status e criticidade."
        actions={(
          <div className="page-actions">
            {isDemoAuthMode && canDeleteQa ? (
              <button className="btn ghost" type="button" onClick={handleCleanupQa}>Limpar dados QA</button>
            ) : null}
            <PermissionGate permission="ativos:create">
              <button className="btn primary" type="button" onClick={openCreateForm}>Novo ativo</button>
            </PermissionGate>
          </div>
        )}
      />

      <section className="asset-filters" aria-label="Filtros de ativos">
        <label className="asset-search">
          Buscar ativo
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por TAG, nome, categoria ou local"
          />
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as AssetStatus | "")}>
            <option value="">Todos os status</option>
            {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Criticidade
          <select value={criticalityFilter} onChange={event => setCriticalityFilter(event.target.value as AssetCriticality | "")}>
            <option value="">Todas as criticidades</option>
            {Object.entries(ASSET_CRITICALITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Setor
          <select value={sectorFilter} onChange={event => setSectorFilter(event.target.value)}>
            <option value="">Todos os setores</option>
            {sectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
          </select>
        </label>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            setSearch("");
            setStatusFilter("");
            setCriticalityFilter("");
            setSectorFilter("");
          }}
        >
          Limpar filtros
        </button>
      </section>

      {feedback ? <div className="feedback-message" role="status">{feedback}</div> : null}
      {pageError ? <div className="error-message" role="alert">{pageError}</div> : null}

      <section className="asset-list-card" aria-labelledby="asset-list-title">
        <header className="asset-list-header">
          <div>
            <h2 id="asset-list-title">Lista de ativos</h2>
            <p>{filteredAssets.length} de {assets.length} ativo(s)</p>
          </div>
          {isDemoAuthMode ? <span className="demo-badge">Dados demo QA-AUTO</span> : null}
        </header>

        {isLoading ? <p className="asset-state" role="status">Carregando ativos...</p> : null}
        {!isLoading && !pageError && filteredAssets.length === 0 ? (
          <p className="asset-state">Nenhum ativo encontrado para os filtros informados.</p>
        ) : null}

        {!isLoading && filteredAssets.length > 0 ? (
          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th scope="col">TAG</th>
                  <th scope="col">Ativo</th>
                  <th scope="col">Setor / local</th>
                  <th scope="col">Status</th>
                  <th scope="col">Criticidade</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map(asset => (
                  <tr key={asset.id}>
                    <td data-label="TAG"><strong>{asset.tag}</strong></td>
                    <td data-label="Ativo">
                      <strong>{asset.name}</strong>
                      <span>{asset.category || "Categoria não informada"}</span>
                    </td>
                    <td data-label="Setor / local">
                      <strong>{asset.setorId || "Setor não informado"}</strong>
                      <span>{asset.localId || "Local não informado"}</span>
                    </td>
                    <td data-label="Status"><span className={`status-badge status-${asset.status.toLowerCase()}`}>{ASSET_STATUS_LABELS[asset.status]}</span></td>
                    <td data-label="Criticidade"><span>{ASSET_CRITICALITY_LABELS[asset.criticality]}</span></td>
                    <td data-label="Ações">
                      <button className="btn ghost" type="button" onClick={() => setDetailsAsset(asset)} aria-label={`Ver detalhes de ${asset.tag}`}>
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {isFormOpen ? (
        <AssetFormDialog
          asset={formAsset}
          error={formError}
          isSaving={isSaving}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
        />
      ) : null}

      {detailsAsset ? (
        <AssetDetailsDialog
          asset={detailsAsset}
          canEdit={canEdit}
          onClose={() => setDetailsAsset(null)}
          onEdit={() => openEditForm(detailsAsset)}
          onInactivate={() => handleInactivate(detailsAsset)}
        />
      ) : null}
    </>
  );
}
