import type { User } from "@supabase/supabase-js";
import type { AuthErrorCode, AuthUser, LoginCredentials, UserRole } from "@/types/auth";
import { authMode, isDemoAuthMode, isSupabaseConfigured, supabase } from "@/services/supabaseClient";

const AUTH_STORAGE_KEY = "gestman365.react.auth";
const DEMO_EMAIL = "admin@gestman365.local";
const DEMO_PASSWORD = "admin";
const USER_ROLES: UserRole[] = ["ADMINISTRADOR", "SUPERVISOR", "PLANEJADOR", "TECNICO", "SOLICITANTE"];

const demoUser: AuthUser = {
  id: "demo-admin",
  name: "Administrador",
  email: DEMO_EMAIL,
  role: "ADMINISTRADOR",
  empresaId: "empresa-demo",
  isActive: true
};

export class AuthServiceError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
  }
}

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function clearCachedUser(): void {
  storage()?.removeItem(AUTH_STORAGE_KEY);
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value.toUpperCase() as UserRole);
}

function normalizeRole(value: unknown): UserRole {
  return isUserRole(value) ? value.toUpperCase() as UserRole : "SOLICITANTE";
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthUser>;
  return Boolean(
    typeof candidate.id === "string" && candidate.id &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    isUserRole(candidate.role) &&
    typeof candidate.empresaId === "string" &&
    typeof candidate.isActive === "boolean"
  );
}

function readCachedUser(): AuthUser | null {
  const currentStorage = storage();
  const cached = currentStorage?.getItem(AUTH_STORAGE_KEY);
  if (!cached) return null;

  try {
    const parsed: unknown = JSON.parse(cached);
    if (isAuthUser(parsed)) return parsed;
  } catch {
    // Corrupted or legacy sessions must not prevent the login page from loading.
  }

  currentStorage?.removeItem(AUTH_STORAGE_KEY);
  return null;
}

function cacheUser(user: AuthUser): void {
  storage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function metadataString(metadata: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function mapSupabaseUser(user: User): AuthUser {
  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};
  const role = normalizeRole(metadata.role ?? metadata.perfil ?? appMetadata.role ?? appMetadata.perfil);
  const empresaId = metadataString(metadata, "empresaId", "empresa_id", "companyId", "company_id") ||
    metadataString(appMetadata, "empresaId", "empresa_id", "companyId", "company_id");
  const isActiveValue = metadata.isActive ?? metadata.is_active ?? metadata.ativo ?? appMetadata.isActive ?? appMetadata.ativo;

  return {
    id: user.id,
    name: metadataString(metadata, "name", "nome", "full_name") || user.email || "Usuario",
    email: user.email ?? "",
    role,
    empresaId,
    avatarUrl: metadataString(metadata, "avatarUrl", "avatar_url") || undefined,
    isActive: typeof isActiveValue === "boolean" ? isActiveValue : true
  };
}

function requireConfiguredSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new AuthServiceError(
      "AUTH_NOT_CONFIGURED",
      "A autenticacao Supabase nao esta configurada. Contate o administrador do sistema."
    );
  }
  return supabase;
}

function validateActiveUser(user: AuthUser): AuthUser {
  if (!user.isActive) {
    clearCachedUser();
    throw new AuthServiceError("INACTIVE_USER", "Este usuario esta inativo. Contate o administrador da empresa.");
  }
  return user;
}

export const authService = {
  mode: authMode,

  async getCurrentUser(): Promise<AuthUser | null> {
    if (isDemoAuthMode) {
      const cached = readCachedUser();
      if (!cached) return null;
      const isExpectedDemoSession = cached.id === demoUser.id && cached.email === demoUser.email;
      if (!isExpectedDemoSession) {
        clearCachedUser();
        return null;
      }
      return validateActiveUser(cached);
    }

    if (!isSupabaseConfigured || !supabase) {
      clearCachedUser();
      return null;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      clearCachedUser();
      return null;
    }

    const user = validateActiveUser(mapSupabaseUser(data.user));
    cacheUser(user);
    return user;
  },

  async login(credentials: LoginCredentials): Promise<AuthUser> {
    if (isDemoAuthMode) {
      const validEmail = credentials.email.trim().toLowerCase() === DEMO_EMAIL;
      const validPassword = credentials.password === DEMO_PASSWORD;
      if (!validEmail || !validPassword) {
        throw new AuthServiceError("INVALID_CREDENTIALS", "E-mail ou senha invalidos.");
      }
      cacheUser(demoUser);
      return demoUser;
    }

    const client = requireConfiguredSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password
    });

    if (error || !data.user) {
      throw new AuthServiceError("INVALID_CREDENTIALS", "E-mail ou senha invalidos.");
    }

    const user = validateActiveUser(mapSupabaseUser(data.user));
    cacheUser(user);
    return user;
  },

  async logout(): Promise<void> {
    clearCachedUser();
    if (isDemoAuthMode) return;
    if (supabase) await supabase.auth.signOut();
  }
};

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthServiceError) return error.message;
  return "Nao foi possivel acessar o sistema. Tente novamente.";
}
