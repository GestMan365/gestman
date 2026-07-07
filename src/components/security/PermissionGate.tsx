import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";
import type { PermissionKey } from "@/types/permissions";

interface PermissionGateProps {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { can } = usePermission();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
