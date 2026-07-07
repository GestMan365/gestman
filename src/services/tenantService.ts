import type { Empresa } from "@/types/tenant";
import { supabase } from "@/services/supabaseClient";

const fallbackEmpresa: Empresa = {
  id: "empresa-demo",
  name: "GestMan365 Demo",
  isActive: true
};

export const tenantService = {
  async listUserTenants(userId: string): Promise<Empresa[]> {
    if (!supabase) return [fallbackEmpresa];

    const { data, error } = await supabase
      .from("empresas_usuarios")
      .select("empresas(id,nome,documento,ativo)")
      .eq("usuario_id", userId);

    if (error || !data?.length) return [fallbackEmpresa];

    return data.map((row: any) => ({
      id: row.empresas.id,
      name: row.empresas.nome,
      document: row.empresas.documento,
      isActive: Boolean(row.empresas.ativo)
    }));
  }
};
