// Cliente HTTP tipado de Wapu. Endpoints y auth espejan el CLI oficial:
// API key persistente vía header `X-API-Key`, JWT vía `Authorization: Bearer`,
// nunca ambos. Errores → WapuError (ver ./errors.ts).
import { WapuError } from "./errors"
import type {
  WapuApiTokenResponse,
  WapuApiTokenStatus,
  WapuContactList,
  WapuDirectFiatTentative,
  WapuDirectFiatTentativeInput,
  WapuFunding,
  WapuHome,
  WapuLoginResponse,
  WapuTentativeAmount,
  WapuTentativeAmountInput,
  WapuTransaction,
  WapuTransactionList,
} from "./types"

const ENV_BASE = import.meta.env.VITE_WAPU_API_BASE_URL as string | undefined
const DEFAULT_BASE_URL = ENV_BASE && ENV_BASE.trim() ? ENV_BASE : "https://be-stage.wapu.app"
const DEFAULT_TIMEOUT_MS = 30_000

export interface WapuClientOptions {
  apiKey?: string
  accessToken?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export interface WapuClient {
  login(email: string, password: string): Promise<WapuLoginResponse>
  createApiToken(): Promise<WapuApiTokenResponse>
  apiTokenStatus(): Promise<WapuApiTokenStatus>
  getHome(): Promise<WapuHome>
  tentativeAmount(input: WapuTentativeAmountInput): Promise<WapuTentativeAmount>
  createDirectFiatTentative(
    input: WapuDirectFiatTentativeInput,
  ): Promise<WapuDirectFiatTentative>
  issueFunding(tentativeUuid: string): Promise<WapuFunding>
  getTransaction(id: string): Promise<WapuTransaction>
  listTransactions(): Promise<WapuTransactionList>
  cancelTransaction(id: string): Promise<WapuTransaction>
  listContacts(filterType?: string): Promise<WapuContactList>
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

interface RequestOpts {
  body?: unknown
  query?: Record<string, string | undefined>
}

export function createWapuClient(options: WapuClientOptions = {}): WapuClient {
  const { apiKey, accessToken } = options
  if (apiKey && accessToken) {
    throw new WapuError(
      "validation",
      "No se puede mezclar API key y access token en el mismo cliente Wapu",
    )
  }

  // En producción usamos un rewrite Vercel ("/api/wapu" → wapu.app) para
  // sortear CORS, así que el baseUrl puede ser relativo. `new URL()` no
  // acepta paths sin host: si arranca con "/", lo absolutizamos con el
  // origin del navegador. En SSR/no-DOM cae a "" y revienta más adelante.
  const rawBase = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "")
  const baseUrl = rawBase.startsWith("/")
    ? `${globalThis.location?.origin ?? ""}${rawBase}`
    : rawBase
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function request<T>(
    method: string,
    path: string,
    opts: RequestOpts = {},
  ): Promise<T> {
    const url = new URL(baseUrl + path)
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v != null) url.searchParams.set(k, v)
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" }
    if (apiKey) headers["X-API-Key"] = apiKey
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`
    if (opts.body !== undefined) headers["Content-Type"] = "application/json"

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res: Response
    try {
      if (apiKey) console.log("[WAPU-TOKEN]", apiKey.slice(0, 8))
      res = await fetchImpl(url.toString(), {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })
    } catch (err) {
      if (controller.signal.aborted) {
        throw new WapuError("network", `Timeout tras ${timeoutMs / 1000}s contra Wapu`, {
          body: err,
        })
      }
      throw new WapuError("network", "No se pudo conectar con Wapu", { body: err })
    } finally {
      clearTimeout(timer)
    }

    const text = await res.text()
    const data = text ? safeJson(text) : null
    if (!res.ok) throw WapuError.fromHttp(res.status, data)
    return data as T
  }

  return {
    login: (email, password) =>
      request("POST", "/users/login", { body: { email, password } }),
    createApiToken: () => request("POST", "/users/api-token", { body: {} }),
    apiTokenStatus: () => request("GET", "/users/api-token/status"),
    getHome: () => request("GET", "/users/home"),
    tentativeAmount: (input) =>
      request("POST", "/transactions/tentative-amount", { body: input }),
    createDirectFiatTentative: (input) =>
      request("POST", "/transactions/direct-fiat/tentatives", { body: input }),
    issueFunding: (tentativeUuid) =>
      request(
        "POST",
        `/transactions/direct-fiat/tentatives/${encodeURIComponent(tentativeUuid)}/funding`,
        { body: {} },
      ),
    getTransaction: (id) =>
      request("GET", `/transactions/${encodeURIComponent(id)}`),
    listTransactions: () => request("GET", "/transactions/my_transactions"),
    cancelTransaction: (id) =>
      request("PATCH", `/transactions/${encodeURIComponent(id)}`, {
        body: { status: "CANCELED" },
      }),
    listContacts: (filterType) =>
      request("GET", "/contacts", {
        query: { filter_type: filterType },
      }),
  }
}
