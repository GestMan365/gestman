import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { ModuleKey, PermissionKey } from "@/types/permissions";
import { canAccessModule, hasPermission } from "@/utils/permissions";

interface ProtectedRouteProps {
  children?: ReactNode;
  moduleKey?: ModuleKey;
  permission?: PermissionKey;
}

export function ProtectedRoute({ children, moduleKey, permission }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="route-loading">Carregando GestMan365...</div>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (moduleKey && !canAccessModule(user, moduleKey)) {
    return <Navigate to="/403" replace />;
  }

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to="/403" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
