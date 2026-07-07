import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { USER_ROLE_LABELS } from "@/types/auth";

export function Topbar() {
  const { user, logout } = useAuth();
  const { tenants, activeTenant, setActiveTenantId } = useTenant();

  return (
    <header className="topbar">
      <div>
        <span className="topbar-eyebrow">Empresa ativa</span>
        <select
          className="tenant-select"
          value={activeTenant?.id ?? ""}
          onChange={event => setActiveTenantId(event.target.value)}
        >
          {tenants.map(tenant => (
            <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
          ))}
        </select>
      </div>
      <div className="topbar-user">
        <div>
          <strong>{user?.name}</strong>
          <span>{user ? USER_ROLE_LABELS[user.role] : ""}</span>
        </div>
        <button className="btn ghost" type="button" onClick={logout}>Sair</button>
      </div>
    </header>
  );
}
