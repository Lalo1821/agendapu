import { describe, expect, it } from "vitest"
import { decrypt, deriveKey, encrypt, generateSalt } from "./index"

const PASSWORD = "correct horse battery staple"
const SECRET = "wapu-api-key-abc123"

describe("crypto round-trip", () => {
  it("descifra lo que cifró con la misma clave", async () => {
    const salt = generateSalt()
    const key = await deriveKey(PASSWORD, salt)
    const ct = await encrypt(key, SECRET)
    expect(await decrypt(key, ct)).toBe(SECRET)
  })

  it("password equivocado no descifra", async () => {
    const salt = generateSalt()
    const k1 = await deriveKey(PASSWORD, salt)
    const k2 = await deriveKey("password incorrecto", salt)
    const ct = await encrypt(k1, SECRET)
    await expect(decrypt(k2, ct)).rejects.toThrow()
  })

  it("salt distinto produce clave distinta para el mismo password", async () => {
    const k1 = await deriveKey(PASSWORD, generateSalt())
    const k2 = await deriveKey(PASSWORD, generateSalt())
    const ct = await encrypt(k1, SECRET)
    await expect(decrypt(k2, ct)).rejects.toThrow()
  })

  it("dos cifrados del mismo plaintext difieren (IV aleatorio)", async () => {
    const key = await deriveKey(PASSWORD, generateSalt())
    const a = await encrypt(key, SECRET)
    const b = await encrypt(key, SECRET)
    expect(a).not.toBe(b)
  })

  it("modificar un byte del ciphertext rompe el descifrado (AES-GCM auth)", async () => {
    const key = await deriveKey(PASSWORD, generateSalt())
    const ct = await encrypt(key, SECRET)
    const tampered = ct.slice(0, -1) + (ct.endsWith("A") ? "B" : "A")
    await expect(decrypt(key, tampered)).rejects.toThrow()
  })

  it("rechaza payload con formato/versión incorrectos", async () => {
    const key = await deriveKey(PASSWORD, generateSalt())
    await expect(decrypt(key, "no-tiene-puntos")).rejects.toThrow(/format/)
    await expect(decrypt(key, "v9.aaa.bbb")).rejects.toThrow(/format/)
  })

  it("soporta plaintext vacío y unicode", async () => {
    const key = await deriveKey(PASSWORD, generateSalt())
    const empty = await encrypt(key, "")
    expect(await decrypt(key, empty)).toBe("")
    const unicode = "🦍 hola, ¿qué tal? — δοκιμή"
    const ctU = await encrypt(key, unicode)
    expect(await decrypt(key, ctU)).toBe(unicode)
  })
})
