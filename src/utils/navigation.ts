import type { NavigationItem } from "@/types/navigation";

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", path: "/dashboard", moduleKey: "dashboard", icon: "grid" },
  { label: "Ativos", path: "/ativos", moduleKey: "ativos", icon: "asset" },
  { label: "Solicitacoes", path: "/solicitacoes", moduleKey: "solicitacoes", icon: "request" },
  { label: "Ordens de Servico", path: "/ordens-servico", moduleKey: "ordensServico", icon: "work-order" },
  { label: "PCM", path: "/pcm", moduleKey: "pcm", icon: "calendar" },
  { label: "Relatorios", path: "/relatorios", moduleKey: "relatorios", icon: "report" },
  { label: "Administracao", path: "/administracao", moduleKey: "administracao", icon: "admin" }
];
