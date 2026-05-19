// Mock determinista del backend Wapu. Es el contrato canónico mientras no
// haya token real (Fase 4 lo confirma). Lo usan los tests y, opcionalmente,
// la health-check page con ?mock=1 para demos sin token.
import { createWapuClient, type WapuClient } from "./client"
import type { WapuContact } from "./types"

export interface WapuMockState {
  username: string
  lightningAddress: string
  accessToken: string
  apiKey: string
  tentativeUuid: string
  bolt11: string
  depositTransactionId: string
  txId: string
  tentativeSats: number
  // Estados devueltos por getTransaction en orden (el último se repite).
  // Permite simular polling PENDING → CONFIRMED.
  txStatusSequence: string[]
  contacts: WapuContact[]
  // Si el pathname incluye la clave, responde ese status HTTP.
  errorOn?: Record<string, number>
}

export const MOCK_WAPU: WapuMockState = {
  username: "demo",
  lightningAddress: "demo@wapu.app",
  accessToken: "mock-jwt-token",
  apiKey: "mock-api-key",
  tentativeUuid: "mock-tentative-uuid",
  bolt11: "lnbc100u1pmockinvoice0000000000000000000000000000000000",
  depositTransactionId: "mock-deposit-tx",
  txId: "mock-tx-1",
  tentativeSats: 12_345,
  txStatusSequence: ["PENDING", "CONFIRMED"],
  contacts: [
    {
      id: "c1",
      alias: "juan.mp",
      receiver_name: "Juan Pérez",
      kind: "bank_alias",
      is_favourite: true,
    },
  ],
}

function json(status: number, obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== "string") return {}
  try {
    return JSON.parse(init.body) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function createWapuMockFetch(overrides: Partial<WapuMockState> = {}): typeof fetch {
  const state: WapuMockState = { ...MOCK_WAPU, ...overrides }
  let txPollCount = 0

  const mockFetch: typeof fetch = async (input, init) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const { pathname } = new URL(rawUrl)
    const method = (init?.method ?? "GET").toUpperCase()

    if (state.errorOn) {
      for (const [fragment, status] of Object.entries(state.errorOn)) {
        if (pathname.includes(fragment)) {
          return json(status, { detail: `mock: error forzado (${status})` })
        }
      }
    }

    // --- Auth ---
    if (method === "POST" && pathname === "/users/login") {
      return json(200, { access_token: state.accessToken })
    }
    if (method === "POST" && pathname === "/users/api-token") {
      return json(200, { api_key: state.apiKey })
    }
    if (method === "GET" && pathname === "/users/api-token/status") {
      return json(200, { active: true, created_at: "2026-05-17T00:00:00Z" })
    }

    // --- Usuario ---
    if (method === "GET" && pathname === "/users/home") {
      return json(200, {
        username: state.username,
        lightning_address: state.lightningAddress,
      })
    }

    // --- Cotización / tentatives ---
    if (method === "POST" && pathname === "/transactions/tentative-amount") {
      const body = parseBody(init)
      return json(200, {
        amount: Number(body.amount ?? 0),
        amount_taken: state.tentativeSats,
        currency_payment: body.currency_payment ?? "ARS",
        currency_taken: body.currency_taken ?? "SAT",
        expires_at: "2026-05-17T00:05:00Z",
      })
    }
    if (method === "POST" && pathname === "/transactions/direct-fiat/tentatives") {
      return json(200, { tentative_uuid: state.tentativeUuid, ...parseBody(init) })
    }
    if (method === "POST" && pathname.endsWith("/funding")) {
      return json(200, {
        bolt11: state.bolt11,
        deposit_transaction_id: state.depositTransactionId,
      })
    }

    // --- Transacciones ---
    if (method === "GET" && pathname === "/transactions/my_transactions") {
      return json(200, {
        transactions: [{ id: state.txId, status: state.txStatusSequence.at(-1) }],
      })
    }
    if (method === "PATCH" && pathname.startsWith("/transactions/")) {
      return json(200, { id: pathname.split("/").pop(), status: "CANCELED" })
    }
    if (method === "GET" && pathname.startsWith("/transactions/")) {
      const seq = state.txStatusSequence
      const status = seq[Math.min(txPollCount, seq.length - 1)]
      txPollCount += 1
      return json(200, { id: pathname.split("/").pop(), status })
    }

    // --- Contactos ---
    if (method === "GET" && pathname === "/contacts") {
      return json(200, { contacts: state.contacts })
    }

    return json(404, { detail: `mock: ruta no manejada ${method} ${pathname}` })
  }

  return mockFetch
}

export function createMockWapuClient(overrides: Partial<WapuMockState> = {}): WapuClient {
  const state: WapuMockState = { ...MOCK_WAPU, ...overrides }
  return createWapuClient({
    apiKey: state.apiKey,
    fetchImpl: createWapuMockFetch(overrides),
  })
}
