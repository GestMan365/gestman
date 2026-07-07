import { ModuleCard } from "@/components/common/ModuleCard";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/security/PermissionGate";

export function AssetsPage() {
  return (
    <>
      <PageHeader
        title="Ativos"
        description="Cadastro hierarquico de regioes, locais de instalacao, equipamentos, TAGs e subtags."
        actions={(
          <PermissionGate permission="ativos:create">
            <button className="btn primary" type="button">Novo ativo</button>
          </PermissionGate>
        )}
      />
      <div className="module-grid">
        <ModuleCard title="Arvore de ativos" description="Preparado para estrutura multiempresa e parque industrial." />
        <ModuleCard title="Equipamentos" description="Base para codigo interno, criticidade, fabricante, modelo e status." />
      </div>
    </>
  );
}
