import { supabase } from "@/lib/supabase"
import { generateSalt } from "./util"

// No hay trigger en Supabase que cree user_profiles al registrarse:
// la app garantiza la fila y su salt. El salt es estable por usuario
// (de él depende la derivación PBKDF2), así que solo se genera una vez.
export async function ensureProfile(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("salt")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw error
  if (data) return data.salt

  const salt = generateSalt()
  const { error: insertError } = await supabase
    .from("user_profiles")
    .insert({ id: userId, salt })

  if (insertError) {
    // Carrera (p. ej. doble invocación en StrictMode): releer la fila ganadora.
    const retry = await supabase
      .from("user_profiles")
      .select("salt")
      .eq("id", userId)
      .maybeSingle()
    if (retry.error) throw retry.error
    if (retry.data) return retry.data.salt
    throw insertError
  }

  return salt
}
