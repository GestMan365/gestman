import { NavLink } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { navigationItems } from "@/utils/navigation";
import { cn } from "@/utils/cn";

export function Sidebar() {
  const { canAccess } = usePermission();
  const visibleItems = navigationItems.filter(item => canAccess(item.moduleKey));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <strong>GESTMAN365</strong>
        <span>CMMS / EAM</span>
      </div>
      <nav className="sidebar-nav" aria-label="Menu principal">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn("sidebar-link", isActive && "active")}
          >
            <span className="sidebar-icon" aria-hidden="true">{item.icon.slice(0, 2).toUpperCase()}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
