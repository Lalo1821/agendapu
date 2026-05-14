import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

let cached: SupabaseClient<Database> | null = null

function build(): SupabaseClient<Database> {
  if (cached) return cached
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local",
    )
  }
  cached = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  return cached
}

// Lazy proxy: el cliente se construye en el primer uso, no al importar el módulo.
// Permite que el build de Vercel pase aunque las env vars no estén configuradas todavía.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    return Reflect.get(build(), prop, receiver)
  },
})
