import { ModuleCard } from "@/components/common/ModuleCard";
import { PageHeader } from "@/components/common/PageHeader";

export function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Relatorios"
        description="Relatorios automaticos por empresa, periodo, ativo, executante e tipo de manutencao."
      />
      <div className="module-grid">
        <ModuleCard title="Indicadores" description="Base para relatorios de MTTR, MTBF, disponibilidade e backlog." />
        <ModuleCard title="Produtividade" description="Base para horas apontadas, ordens atendidas e executantes." />
      </div>
    </>
  );
}
