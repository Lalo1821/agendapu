import { describe, expect, it, vi } from "vitest"
import { createWapuClient } from "./client"
import { WapuError } from "./errors"
import { createMockWapuClient, createWapuMockFetch } from "./mock"

const BASE = "https://be-test.wapu.app"

describe("createWapuClient — happy path contra mock", () => {
  it("login y createApiToken devuelven sus campos", async () => {
    const c = createWapuClient({ fetchImpl: createWapuMockFetch() })
    expect((await c.login("a@b.com", "pw")).access_token).toBe("mock-jwt-token")
    expect((await c.createApiToken()).api_key).toBe("mock-api-key")
  })

  it("getHome trae username + lightning address", async () => {
    const c = createMockWapuClient({ lightningAddress: "lalo@wapu.app" })
    const home = await c.getHome()
    expect(home.username).toBe("demo")
    expect(home.lightning_address).toBe("lalo@wapu.app")
  })

  it("flujo just-in-time: tentative → direct-fiat → funding", async () => {
    const c = createMockWapuClient({ tentativeSats: 9999, bolt11: "lnbc-x" })
    const quote = await c.tentativeAmount({
      amount: 50000,
      currency_payment: "ARS",
      currency_taken: "SAT",
      type: "fiat_transfer",
    })
    expect(quote.amount).toBe(50000)
    expect(quote.amount_taken).toBe(9999)

    const tentative = await c.createDirectFiatTentative({
      amount_ars: 50000,
      type: "fiat_transfer",
      alias: "juan.mp",
      receiver_name: "Juan",
      funding_method: "LIGHTNING",
      network: "LIGHTNING",
    })
    expect(tentative.tentative_id).toBe("mock-tentative-uuid")

    const funding = await c.issueFunding(tentative.tentative_id)
    expect(funding.bolt11).toBe("lnbc-x")
    expect(funding.deposit_transaction_id).toBe("mock-deposit-tx")
  })

  it("getTransaction avanza la secuencia de estados (polling)", async () => {
    const c = createMockWapuClient({ txStatusSequence: ["PENDING", "CONFIRMED"] })
    expect((await c.getTransaction("t1")).status).toBe("PENDING")
    expect((await c.getTransaction("t1")).status).toBe("CONFIRMED")
    expect((await c.getTransaction("t1")).status).toBe("CONFIRMED")
  })

  it("listTransactions, cancelTransaction y listContacts", async () => {
    const c = createMockWapuClient()
    expect((await c.listTransactions()).transactions).toHaveLength(1)
    expect((await c.cancelTransaction("t9")).status).toBe("CANCELED")
    const contacts = await c.listContacts("bank_alias")
    expect(contacts.contacts[0].alias).toBe("juan.mp")
  })
})

describe("createWapuClient — auth y request shape", () => {
  it("usa X-API-Key con apiKey", async () => {
    const spy = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }))
    const c = createWapuClient({ apiKey: "k1", baseUrl: BASE, fetchImpl: spy })
    await c.getHome()
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(`${BASE}/users/home`)
    expect((init?.headers as Record<string, string>)["X-API-Key"]).toBe("k1")
    expect((init?.headers as Record<string, string>)["Authorization"]).toBeUndefined()
  })

  it("usa Authorization: Bearer con accessToken y serializa el body", async () => {
    const spy = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }))
    const c = createWapuClient({ accessToken: "jwt", baseUrl: BASE, fetchImpl: spy })
    await c.tentativeAmount({
      amount: 100,
      currency_payment: "ARS",
      currency_taken: "SAT",
      type: "fiat_transfer",
    })
    const [, init] = spy.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer jwt")
    expect(headers["Content-Type"]).toBe("application/json")
    expect(JSON.parse(init?.body as string).amount).toBe(100)
  })

  it("rechaza mezclar apiKey y accessToken", () => {
    expect(() => createWapuClient({ apiKey: "k", accessToken: "j" })).toThrow(WapuError)
  })

  it("listContacts no manda filter_type cuando es undefined", async () => {
    const spy = vi.fn<typeof fetch>(
      async () => new Response('{"contacts":[]}', { status: 200 }),
    )
    const c = createWapuClient({ apiKey: "k", baseUrl: BASE, fetchImpl: spy })
    await c.listContacts()
    expect(spy.mock.calls[0][0]).toBe(`${BASE}/contacts`)
  })

  it("acepta baseUrl relativo y lo absolutiza con location.origin", async () => {
    // En Vercel prod baseUrl viene como "/api/wapu" (rewrite a wapu.app),
    // así que `new URL(...)` necesita un host: lo tomamos del navegador.
    const spy = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }))
    const c = createWapuClient({ apiKey: "k", baseUrl: "/api/wapu", fetchImpl: spy })
    await c.getHome()
    expect(spy.mock.calls[0][0]).toBe(
      `${globalThis.location.origin}/api/wapu/users/home`,
    )
  })
})

describe("WapuError — mapeo de status a kind/exitCode", () => {
  const cases: Array<[number, string, number]> = [
    [400, "validation", 2],
    [404, "validation", 2],
    [401, "auth", 3],
    [403, "auth", 3],
    [429, "rate_limit", 4],
    [500, "network", 1],
    [503, "network", 1],
  ]

  for (const [status, kind, exit] of cases) {
    it(`HTTP ${status} → ${kind} (exit ${exit})`, async () => {
      const c = createWapuClient({
        apiKey: "k",
        fetchImpl: createWapuMockFetch({ errorOn: { "/users/home": status } }),
      })
      const err = await c.getHome().catch((e) => e)
      expect(err).toBeInstanceOf(WapuError)
      expect(err.kind).toBe(kind)
      expect(err.exitCode).toBe(exit)
      expect(err.status).toBe(status)
    })
  }

  it("extrae el mensaje del body (detail)", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "alias inválido" }), { status: 400 }),
    )
    const c = createWapuClient({ apiKey: "k", fetchImpl })
    const err: WapuError = await c.getHome().catch((e) => e)
    expect(err.message).toBe("alias inválido")
  })

  it("error de red → kind network (exit 1)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    const c = createWapuClient({ apiKey: "k", fetchImpl })
    const err: WapuError = await c.getHome().catch((e) => e)
    expect(err).toBeInstanceOf(WapuError)
    expect(err.kind).toBe("network")
    expect(err.exitCode).toBe(1)
  })

  it("timeout aborta y devuelve kind network", async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        )
      })
    const c = createWapuClient({ apiKey: "k", fetchImpl, timeoutMs: 10 })
    const err: WapuError = await c.getHome().catch((e) => e)
    expect(err).toBeInstanceOf(WapuError)
    expect(err.kind).toBe("network")
    expect(err.message).toMatch(/timeout/i)
  })
})
