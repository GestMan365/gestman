import type { AuthUser } from "@/types/auth";
import type { ModuleKey, PermissionKey } from "@/types/permissions";
import { ROLE_PERMISSIONS } from "@/types/permissions";

export function getRolePermissions(user?: AuthUser | null): PermissionKey[] {
  if (!user || !user.isActive) return [];
  return ROLE_PERMISSIONS[user.role] ?? [];
}

export function hasPermission(user: AuthUser | null | undefined, permission: PermissionKey): boolean {
  return getRolePermissions(user).includes(permission);
}

export function canAccessModule(user: AuthUser | null | undefined, moduleKey: ModuleKey): boolean {
  return hasPermission(user, `${moduleKey}:view`);
}

export function canManageTenant(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "administracao:manage");
}
