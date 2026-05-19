// Wrapper minimal sobre @getalby/sdk (NWC). Mapea todo a NwcError tipado
// y garantiza timeout + cierre de conexión. Lo consume Fase 4 al pagar.
//
// El SDK (~heavy, arrastra nostr-tools) se importa de forma diferida: no entra
// al bundle principal, solo se descarga cuando se usa NWC de verdad.
import type { NWCClient } from "@getalby/sdk"
import { NwcError } from "./errors"

const DEFAULT_TIMEOUT_MS = 30_000

type SdkModule = typeof import("@getalby/sdk")
let sdkPromise: Promise<SdkModule> | null = null
function loadSdk(): Promise<SdkModule> {
  if (!sdkPromise) sdkPromise = import("@getalby/sdk")
  return sdkPromise
}

// Códigos NIP-47 (https://github.com/nostr-protocol/nips/blob/master/47.md#error-codes)
function mapWalletCode(code: string, err: unknown): NwcError {
  switch (code) {
    case "INSUFFICIENT_BALANCE":
      return new NwcError("insufficient_balance", "Saldo insuficiente en la wallet", err)
    case "QUOTA_EXCEEDED":
      return new NwcError(
        "insufficient_balance",
        "Se superó el límite de gasto de esta conexión NWC",
        err,
      )
    case "UNAUTHORIZED":
    case "RESTRICTED":
      return new NwcError("user_rejected", "La wallet rechazó el pago", err)
    case "RATE_LIMITED":
      return new NwcError("wallet_offline", "La wallet está limitando solicitudes, reintentá", err)
    default:
      return new NwcError("unknown", `La wallet devolvió un error (${code})`, err)
  }
}

function mapError(err: unknown, sdk: SdkModule): NwcError {
  if (err instanceof NwcError) return err
  if (err instanceof sdk.Nip47TimeoutError)
    return new NwcError("timeout", "La wallet no respondió a tiempo", err)
  if (err instanceof sdk.Nip47NetworkError)
    return new NwcError("wallet_offline", "No se pudo conectar con la wallet", err)
  if (err instanceof sdk.Nip47WalletError || err instanceof sdk.Nip47Error)
    return mapWalletCode((err as { code: string }).code, err)
  return new NwcError(
    "unknown",
    err instanceof Error ? err.message : "Error desconocido de la wallet",
    err,
  )
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new NwcError("timeout", `Timeout tras ${ms / 1000}s esperando a la wallet`)),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function withClient<T>(
  connectionString: string,
  timeoutMs: number,
  fn: (client: NWCClient) => Promise<T>,
): Promise<T> {
  const sdk = await loadSdk()
  let client: NWCClient
  try {
    client = new sdk.NWCClient({ nostrWalletConnectUrl: connectionString })
  } catch (err) {
    throw new NwcError("wallet_offline", "La cadena de conexión NWC es inválida", err)
  }
  try {
    return await withTimeout(fn(client), timeoutMs)
  } catch (err) {
    throw mapError(err, sdk)
  } finally {
    client.close()
  }
}

export interface PayInvoiceResult {
  preimage: string
  feesPaidMsat: number
}

// Paga un bolt11 desde la wallet del usuario vía NWC.
export async function payInvoice(
  connectionString: string,
  bolt11: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<PayInvoiceResult> {
  return withClient(connectionString, timeoutMs, async (client) => {
    const res = await client.payInvoice({ invoice: bolt11 })
    return { preimage: res.preimage, feesPaidMsat: res.fees_paid ?? 0 }
  })
}

export interface NwcInfo {
  alias: string
  network: string
  methods: string[]
  lud16: string | null
}

// Health-check: la wallet está viva y qué métodos soporta.
export async function getNwcInfo(
  connectionString: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<NwcInfo> {
  return withClient(connectionString, timeoutMs, async (client) => {
    const info = await client.getInfo()
    return {
      alias: info.alias,
      network: info.network,
      methods: info.methods,
      lud16: info.lud16 ?? null,
    }
  })
}

export interface NwcBalance {
  balanceMsat: number
  balanceSats: number
}

export async function getNwcBalance(
  connectionString: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<NwcBalance> {
  return withClient(connectionString, timeoutMs, async (client) => {
    const { balance } = await client.getBalance()
    return { balanceMsat: balance, balanceSats: Math.floor(balance / 1000) }
  })
}
