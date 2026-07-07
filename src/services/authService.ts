import type { AuthUser, LoginCredentials, UserRole } from "@/types/auth";
import { supabase } from "@/services/supabaseClient";

const AUTH_STORAGE_KEY = "gestman365.react.auth";

const demoUser: AuthUser = {
  id: "demo-admin",
  name: "Administrador",
  email: "admin@gestman365.local",
  role: "ADMINISTRADOR",
  empresaId: "empresa-demo",
  isActive: true
};

export const authService = {
  async getCurrentUser(): Promise<AuthUser | null> {
    const cached = localStorage.getItem(AUTH_STORAGE_KEY);
    if (cached) return JSON.parse(cached) as AuthUser;

    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      name: data.user.user_metadata?.name ?? data.user.email ?? "Usuario",
      email: data.user.email ?? "",
      role: (data.user.user_metadata?.role as UserRole) ?? "SOLICITANTE",
      empresaId: data.user.user_metadata?.empresaId ?? "",
      avatarUrl: data.user.user_metadata?.avatarUrl,
      isActive: true
    };
  },

  async login(credentials: LoginCredentials): Promise<AuthUser> {
    if (!supabase) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoUser));
      return demoUser;
    }

    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    const user: AuthUser = {
      id: data.user.id,
      name: data.user.user_metadata?.name ?? data.user.email ?? "Usuario",
      email: data.user.email ?? "",
      role: (data.user.user_metadata?.role as UserRole) ?? "SOLICITANTE",
      empresaId: data.user.user_metadata?.empresaId ?? "",
      avatarUrl: data.user.user_metadata?.avatarUrl,
      isActive: true
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  async logout(): Promise<void> {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (supabase) await supabase.auth.signOut();
  }
};
