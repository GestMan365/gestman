import { useContext } from "react";
import { TenantContext } from "@/contexts/TenantContext";

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant deve ser usado dentro de TenantProvider.");
  return context;
}
