import type { UserRole } from "@/types/auth";

export type ModuleKey =
  | "dashboard"
  | "ativos"
  | "solicitacoes"
  | "ordensServico"
  | "pcm"
  | "relatorios"
  | "administracao";

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "plan"
  | "execute"
  | "close"
  | "manage";

export type PermissionKey = `${ModuleKey}:${PermissionAction}`;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  ativos: "Ativos",
  solicitacoes: "Solicitacoes",
  ordensServico: "Ordens de Servico",
  pcm: "PCM",
  relatorios: "Relatorios",
  administracao: "Administracao"
};

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  ADMINISTRADOR: [
    "dashboard:view",
    "ativos:view",
    "ativos:create",
    "ativos:edit",
    "ativos:delete",
    "ativos:manage",
    "solicitacoes:view",
    "solicitacoes:create",
    "solicitacoes:edit",
    "solicitacoes:delete",
    "solicitacoes:approve",
    "ordensServico:view",
    "ordensServico:create",
    "ordensServico:edit",
    "ordensServico:delete",
    "ordensServico:execute",
    "ordensServico:close",
    "ordensServico:manage",
    "pcm:view",
    "pcm:plan",
    "pcm:manage",
    "relatorios:view",
    "administracao:view",
    "administracao:manage"
  ],
  SUPERVISOR: [
    "dashboard:view",
    "ativos:view",
    "ativos:create",
    "ativos:edit",
    "solicitacoes:view",
    "solicitacoes:create",
    "solicitacoes:edit",
    "solicitacoes:approve",
    "ordensServico:view",
    "ordensServico:create",
    "ordensServico:edit",
    "ordensServico:execute",
    "ordensServico:close",
    "pcm:view",
    "relatorios:view"
  ],
  PLANEJADOR: [
    "dashboard:view",
    "ativos:view",
    "solicitacoes:view",
    "ordensServico:view",
    "ordensServico:create",
    "ordensServico:edit",
    "pcm:view",
    "pcm:plan",
    "relatorios:view"
  ],
  TECNICO: [
    "dashboard:view",
    "ativos:view",
    "solicitacoes:view",
    "solicitacoes:create",
    "ordensServico:view",
    "ordensServico:execute",
    "ordensServico:close"
  ],
  SOLICITANTE: [
    "dashboard:view",
    "ativos:view",
    "solicitacoes:view",
    "solicitacoes:create",
    "ordensServico:view"
  ]
};
