import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AuthMode = "demo" | "supabase";

const configuredAuthMode = import.meta.env.VITE_AUTH_MODE?.trim().toLowerCase();
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const authMode: AuthMode = configuredAuthMode === "demo" ? "demo" : "supabase";
export const isDemoAuthMode = authMode === "demo";

function isUsableConfiguration(value: string | undefined, placeholders: string[]): value is string {
  if (!value) return false;
  return !placeholders.some(placeholder => value.toLowerCase().includes(placeholder));
}

export const isSupabaseConfigured =
  isUsableConfiguration(supabaseUrl, ["seu-projeto", "your-project"]) &&
  isUsableConfiguration(supabaseKey, ["sua_chave", "your_key"]);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
