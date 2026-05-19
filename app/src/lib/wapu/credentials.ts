import { supabase } from "@/lib/supabase"
import { decrypt, encrypt } from "@/lib/crypto"

const METHOD = "pbkdf2-aes-gcm" as const

// El token Wapu se cifra client-side; el servidor solo ve el blob.
export async function saveWapuToken(
  userId: string,
  key: CryptoKey,
  token: string,
): Promise<void> {
  const encrypted_api_token = await encrypt(key, token.trim())
  const { error } = await supabase.from("wapu_credentials").upsert(
    {
      user_id: userId,
      encrypted_api_token,
      encryption_method: METHOD,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  if (error) throw error
}

export async function getWapuToken(
  userId: string,
  key: CryptoKey,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("wapu_credentials")
    .select("encrypted_api_token")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return decrypt(key, data.encrypted_api_token)
}

export async function hasWapuToken(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("wapu_credentials")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId)
  if (error) throw error
  return (count ?? 0) > 0
}
