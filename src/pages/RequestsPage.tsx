import { ModuleCard } from "@/components/common/ModuleCard";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/security/PermissionGate";

export function RequestsPage() {
  return (
    <>
      <PageHeader
        title="Solicitacoes"
        description="Canal para abertura de chamados antes da conversao em ordem de servico."
        actions={(
          <PermissionGate permission="solicitacoes:create">
            <button className="btn primary" type="button">Nova solicitacao</button>
          </PermissionGate>
        )}
      />
      <ModuleCard title="Fluxo de solicitacoes" description="Estrutura preparada para triagem, aprovacao e conversao em O.S." />
    </>
  );
}
