import type { ModuleKey, PermissionKey } from "@/types/permissions";
import { canAccessModule, hasPermission } from "@/utils/permissions";
import { useAuth } from "@/hooks/useAuth";

export function usePermission() {
  const { user } = useAuth();

  return {
    can: (permission: PermissionKey) => hasPermission(user, permission),
    canAccess: (moduleKey: ModuleKey) => canAccessModule(user, moduleKey)
  };
}
