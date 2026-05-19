import { supabase } from "@/lib/supabase"
import { decrypt, encrypt } from "@/lib/crypto"

const METHOD = "pbkdf2-aes-gcm" as const

// MVP single-wallet: una conexión NWC por usuario. Reemplaza la anterior.
export async function saveNwcConnection(
  userId: string,
  key: CryptoKey,
  connectionString: string,
  label = "Principal",
): Promise<void> {
  const encrypted_connection_string = await encrypt(key, connectionString.trim())
  const del = await supabase.from("nwc_connections").delete().eq("user_id", userId)
  if (del.error) throw del.error
  const { error } = await supabase.from("nwc_connections").insert({
    user_id: userId,
    label,
    encrypted_connection_string,
    encryption_method: METHOD,
  })
  if (error) throw error
}

export async function getNwcConnection(
  userId: string,
  key: CryptoKey,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("nwc_connections")
    .select("encrypted_connection_string")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return decrypt(key, data.encrypted_connection_string)
}

export async function hasNwcConnection(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("nwc_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  if (error) throw error
  return (count ?? 0) > 0
}
