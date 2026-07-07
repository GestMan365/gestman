import { ModuleCard } from "@/components/common/ModuleCard";
import { PageHeader } from "@/components/common/PageHeader";

export function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visao executiva para indicadores de manutencao, backlog, disponibilidade, MTTR e MTBF."
      />
      <div className="module-grid">
        <ModuleCard title="Indicadores CMMS" description="Area preparada para KPIs por empresa, unidade e periodo." />
        <ModuleCard title="Backlog" description="Base para consolidar O.S abertas, em execucao e concluidas." />
        <ModuleCard title="Confiabilidade" description="Espaco reservado para MTTR, MTBF e disponibilidade operacional." />
      </div>
    </>
  );
}
