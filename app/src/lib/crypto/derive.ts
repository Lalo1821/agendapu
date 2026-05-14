import { fromBase64Url } from "./util"

export const PBKDF2_ITERATIONS = 600_000

export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password)
  const saltBytes = fromBase64Url(salt)

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}
