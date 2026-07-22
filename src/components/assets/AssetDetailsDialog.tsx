import { ASSET_CRITICALITY_LABELS, ASSET_STATUS_LABELS, type Asset } from "@/types/assets";

interface AssetDetailsDialogProps {
  asset: Asset;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onInactivate: () => void;
}

export function AssetDetailsDialog({ asset, canEdit, onClose, onEdit, onInactivate }: AssetDetailsDialogProps) {
  return (
    <div className="dialog-backdrop">
      <section className="dialog-card asset-details" role="dialog" aria-modal="true" aria-labelledby="asset-details-title">
        <header className="dialog-header">
          <div>
            <span className="asset-tag">{asset.tag}</span>
            <h2 id="asset-details-title">{asset.name}</h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Fechar detalhes">Fechar</button>
        </header>

        <dl className="details-grid">
          <div><dt>Status</dt><dd>{ASSET_STATUS_LABELS[asset.status]}</dd></div>
          <div><dt>Criticidade</dt><dd>{ASSET_CRITICALITY_LABELS[asset.criticality]}</dd></div>
          <div><dt>Categoria</dt><dd>{asset.category || "Não informado"}</dd></div>
          <div><dt>Setor</dt><dd>{asset.setorId || "Não informado"}</dd></div>
          <div><dt>Localização</dt><dd>{asset.localId || "Não informado"}</dd></div>
          <div><dt>Fabricante</dt><dd>{asset.manufacturer || "Não informado"}</dd></div>
          <div><dt>Modelo</dt><dd>{asset.model || "Não informado"}</dd></div>
          <div><dt>Número de série</dt><dd>{asset.serialNumber || "Não informado"}</dd></div>
          <div className="details-wide"><dt>Descrição</dt><dd>{asset.description || "Não informado"}</dd></div>
        </dl>

        <footer className="dialog-actions">
          {canEdit ? (
            <>
              <button className="btn ghost" type="button" onClick={onInactivate} disabled={!asset.isActive}>
                {asset.isActive ? "Inativar ativo" : "Ativo inativo"}
              </button>
              <button className="btn primary" type="button" onClick={onEdit}>Editar ativo</button>
            </>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
