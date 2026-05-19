import { beforeEach, describe, expect, it, vi } from "vitest"

// Igual patrón que wapu/credentials.test.ts: builder encadenable thenable.
// `results` es una cola (para flujos con 2 queries: delete + insert);
// si está vacía cae a `result`.
const h = vi.hoisted(() => {
  const state: { result: unknown; results: unknown[] } = {
    result: { data: null, error: null },
    results: [],
  }
  const next = () => (state.results.length ? state.results.shift() : state.result)
  const from = vi.fn()
  return { state, next, from }
})

vi.mock("@/lib/supabase", () => ({ supabase: { from: h.from } }))
vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn(async (_k: CryptoKey, t: string) => `enc:${t}`),
  decrypt: vi.fn(async (_k: CryptoKey, b: string) => b.replace(/^enc:/, "")),
}))

const { saveNwcConnection, getNwcConnection, hasNwcConnection } = await import(
  "./connections"
)

interface Builder {
  delete: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>
}

let builder: Builder

beforeEach(() => {
  h.state.result = { data: null, error: null }
  h.state.results = []
  const chain = () => builder
  builder = {
    delete: vi.fn(chain),
    insert: vi.fn(chain),
    select: vi.fn(chain),
    eq: vi.fn(chain),
    order: vi.fn(chain),
    limit: vi.fn(chain),
    maybeSingle: vi.fn(async () => h.next()),
    then: (res, rej) => Promise.resolve(h.next()).then(res, rej),
  }
  h.from.mockReturnValue(builder)
})

const KEY = {} as CryptoKey

describe("saveNwcConnection", () => {
  it("borra la conexión previa y cifra+inserta la nueva", async () => {
    h.state.results = [{ error: null }, { error: null }]
    await saveNwcConnection("u1", KEY, "  nostr+walletconnect://x  ", "Primal")
    expect(h.from).toHaveBeenCalledWith("nwc_connections")
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.insert.mock.calls[0][0]).toMatchObject({
      user_id: "u1",
      label: "Primal",
      encrypted_connection_string: "enc:nostr+walletconnect://x",
      encryption_method: "pbkdf2-aes-gcm",
    })
  })

  it("usa label 'Principal' por defecto", async () => {
    h.state.results = [{ error: null }, { error: null }]
    await saveNwcConnection("u1", KEY, "cs")
    expect(builder.insert.mock.calls[0][0].label).toBe("Principal")
  })

  it("si falla el delete, no inserta", async () => {
    h.state.results = [{ error: new Error("del fail") }]
    await expect(saveNwcConnection("u1", KEY, "cs")).rejects.toThrow("del fail")
    expect(builder.insert).not.toHaveBeenCalled()
  })

  it("propaga error del insert", async () => {
    h.state.results = [{ error: null }, { error: new Error("ins fail") }]
    await expect(saveNwcConnection("u1", KEY, "cs")).rejects.toThrow("ins fail")
  })
})

describe("getNwcConnection", () => {
  it("descifra la conexión más reciente", async () => {
    h.state.result = {
      data: { encrypted_connection_string: "enc:cadena" },
      error: null,
    }
    expect(await getNwcConnection("u1", KEY)).toBe("cadena")
  })

  it("null si no hay conexión", async () => {
    h.state.result = { data: null, error: null }
    expect(await getNwcConnection("u1", KEY)).toBeNull()
  })

  it("lanza ante error de supabase", async () => {
    h.state.result = { data: null, error: new Error("x") }
    await expect(getNwcConnection("u1", KEY)).rejects.toThrow("x")
  })
})

describe("hasNwcConnection", () => {
  it("true con count > 0", async () => {
    h.state.result = { count: 2, error: null }
    expect(await hasNwcConnection("u1")).toBe(true)
  })

  it("false con count 0", async () => {
    h.state.result = { count: 0, error: null }
    expect(await hasNwcConnection("u1")).toBe(false)
  })

  it("lanza ante error", async () => {
    h.state.result = { count: null, error: new Error("e") }
    await expect(hasNwcConnection("u1")).rejects.toThrow("e")
  })
})
