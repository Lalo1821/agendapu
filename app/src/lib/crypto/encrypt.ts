import { fromBase64Url, randomBytes, toBase64Url } from "./util"

const VERSION = "v1"
const IV_LENGTH = 12

export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH)
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`
}

export async function decrypt(key: CryptoKey, payload: string): Promise<string> {
  const parts = payload.split(".")
  if (parts.length !== 3 || parts[0] !== VERSION) {
    throw new Error("invalid ciphertext format")
  }
  const iv = fromBase64Url(parts[1])
  const ciphertext = fromBase64Url(parts[2])
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  )
  return new TextDecoder().decode(plaintext)
}
