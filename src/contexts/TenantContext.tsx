import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { tenantService } from "@/services/tenantService";
import type { Empresa } from "@/types/tenant";

interface TenantContextValue {
  tenants: Empresa[];
  activeTenant: Empresa | null;
  setActiveTenantId: (tenantId: string) => void;
}

export const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Empresa[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>("");

  useEffect(() => {
    if (!user) {
      setTenants([]);
      setActiveTenantId("");
      return;
    }

    tenantService.listUserTenants(user.id).then(items => {
      setTenants(items);
      setActiveTenantId(current => current || user.empresaId || items[0]?.id || "");
    });
  }, [user]);

  const activeTenant = tenants.find(item => item.id === activeTenantId) ?? tenants[0] ?? null;

  const value = useMemo<TenantContextValue>(() => ({
    tenants,
    activeTenant,
    setActiveTenantId
  }), [activeTenant, tenants]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
