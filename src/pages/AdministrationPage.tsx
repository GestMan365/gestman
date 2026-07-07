import { ModuleCard } from "@/components/common/ModuleCard";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/security/PermissionGate";

export function AdministrationPage() {
  return (
    <>
      <PageHeader
        title="Administracao"
        description="Configuracoes globais, empresas, usuarios, perfis, permissoes e parametros do sistema."
        actions={(
          <PermissionGate permission="administracao:manage">
            <button className="btn primary" type="button">Configurar</button>
          </PermissionGate>
        )}
      />
      <div className="module-grid">
        <ModuleCard title="Multiempresa" description="Estrutura pronta para isolamento de dados por empresa." />
        <ModuleCard title="Perfis e permissoes" description="Controle por perfil para Administrador, Supervisor, Planejador, Tecnico e Solicitante." />
      </div>
    </>
  );
}
