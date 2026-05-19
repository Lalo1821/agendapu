import { beforeEach, describe, expect, it, vi } from "vitest"

// Builder encadenable mínimo que imita la API de supabase-js: cualquier
// método devuelve el mismo builder y el builder es "thenable" → al await-earlo
// resuelve `h.result`. maybeSingle() también resuelve `h.result`.
const h = vi.hoisted(() => {
  const state: { result: unknown } = { result: { data: null, error: null } }
  const from = vi.fn()
  return { state, from }
})

vi.mock("@/lib/supabase", () => ({ supabase: { from: h.from } }))
vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn(async (_k: CryptoKey, t: string) => `enc:${t}`),
  decrypt: vi.fn(async (_k: CryptoKey, b: string) => b.replace(/^enc:/, "")),
}))

const { saveWapuToken, getWapuToken, hasWapuToken } = await import("./credentials")

interface Builder {
  upsert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>
}

let builder: Builder

beforeEach(() => {
  h.state.result = { data: null, error: null }
  const chain = () => builder
  builder = {
    upsert: vi.fn(chain),
    select: vi.fn(chain),
    eq: vi.fn(chain),
    maybeSingle: vi.fn(async () => h.state.result),
    then: (res, rej) => Promise.resolve(h.state.result).then(res, rej),
  }
  h.from.mockReturnValue(builder)
})

const KEY = {} as CryptoKey

describe("saveWapuToken", () => {
  it("cifra el token y hace upsert con onConflict user_id", async () => {
    await saveWapuToken("u1", KEY, "  token-123  ")
    expect(h.from).toHaveBeenCalledWith("wapu_credentials")
    const [row, opts] = builder.upsert.mock.calls[0]
    expect(row).toMatchObject({
      user_id: "u1",
      encrypted_api_token: "enc:token-123", // trim aplicado antes de cifrar
      encryption_method: "pbkdf2-aes-gcm",
    })
    expect(opts).toEqual({ onConflict: "user_id" })
  })

  it("propaga el error de supabase", async () => {
    h.state.result = { error: new Error("rls denied") }
    await expect(saveWapuToken("u1", KEY, "tok")).rejects.toThrow("rls denied")
  })
})

describe("getWapuToken", () => {
  it("descifra el blob almacenado", async () => {
    h.state.result = { data: { encrypted_api_token: "enc:secreto" }, error: null }
    expect(await getWapuToken("u1", KEY)).toBe("secreto")
  })

  it("devuelve null si no hay fila", async () => {
    h.state.result = { data: null, error: null }
    expect(await getWapuToken("u1", KEY)).toBeNull()
  })

  it("lanza si supabase devuelve error", async () => {
    h.state.result = { data: null, error: new Error("boom") }
    await expect(getWapuToken("u1", KEY)).rejects.toThrow("boom")
  })
})

describe("hasWapuToken", () => {
  it("true cuando count > 0", async () => {
    h.state.result = { count: 1, error: null }
    expect(await hasWapuToken("u1")).toBe(true)
  })

  it("false cuando count es 0 o null", async () => {
    h.state.result = { count: 0, error: null }
    expect(await hasWapuToken("u1")).toBe(false)
  })

  it("lanza ante error", async () => {
    h.state.result = { count: null, error: new Error("nope") }
    await expect(hasWapuToken("u1")).rejects.toThrow("nope")
  })
})
