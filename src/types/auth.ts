export type UserRole =
  | "ADMINISTRADOR"
  | "SUPERVISOR"
  | "PLANEJADOR"
  | "TECNICO"
  | "SOLICITANTE";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  empresaId: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "AUTH_NOT_CONFIGURED"
  | "INACTIVE_USER"
  | "AUTH_UNAVAILABLE";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRADOR: "Administrador",
  SUPERVISOR: "Supervisor",
  PLANEJADOR: "Planejador",
  TECNICO: "Tecnico",
  SOLICITANTE: "Solicitante"
};
