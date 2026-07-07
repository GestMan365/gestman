import { ModuleCard } from "@/components/common/ModuleCard";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/security/PermissionGate";

export function PcmPage() {
  return (
    <>
      <PageHeader
        title="PCM"
        description="Planejamento e controle da manutencao preventiva, corretiva e programada."
        actions={(
          <PermissionGate permission="pcm:plan">
            <button className="btn primary" type="button">Planejar</button>
          </PermissionGate>
        )}
      />
      <div className="module-grid">
        <ModuleCard title="Calendario produtivo" description="Base para programacao de O.S, planos e recursos." />
        <ModuleCard title="Planos de manutencao" description="Preparado para frequencias, checklists e materiais." />
      </div>
    </>
  );
}
