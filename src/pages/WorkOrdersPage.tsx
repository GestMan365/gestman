import { ModuleCard } from "@/components/common/ModuleCard";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/security/PermissionGate";

export function WorkOrdersPage() {
  return (
    <>
      <PageHeader
        title="Ordens de Servico"
        description="Modulo central para planejar, executar, preencher e encerrar O.S."
        actions={(
          <PermissionGate permission="ordensServico:create">
            <button className="btn primary" type="button">Nova O.S</button>
          </PermissionGate>
        )}
      />
      <div className="module-grid">
        <ModuleCard title="Backlog de O.S" description="Preparado para aberta, em execucao, planejada, concluida e cancelada." />
        <ModuleCard title="Execucao" description="Base para tecnico, apontamento, comentario, anexos e assinatura." />
      </div>
    </>
  );
}
