import type { Empresa } from "@/types/tenant";
import { isDemoAuthMode, supabase } from "@/services/supabaseClient";

const fallbackEmpresa: Empresa = {
  id: "empresa-demo",
  name: "GestMan365 Demo",
  isActive: true
};

export const tenantService = {
  async listUserTenants(userId: string): Promise<Empresa[]> {
    if (isDemoAuthMode) return [fallbackEmpresa];
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("empresas_usuarios")
      .select("empresas(id,nome,documento,ativo)")
      .eq("usuario_id", userId);

    if (error || !data?.length) return [];

    return data.map((row: any) => ({
      id: row.empresas.id,
      name: row.empresas.nome,
      document: row.empresas.documento,
      isActive: Boolean(row.empresas.ativo)
    }));
  }
};
