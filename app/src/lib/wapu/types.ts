// Tipos del contrato HTTP de Wapu, extraídos del CLI oficial (wapu-cli).
// Los request bodies son exactos. Las respuestas se tipan de forma permisiva
// (campos conocidos + index) porque su forma fina recién se confirma en Fase 4
// contra un token real; el mock (./mock.ts) es el contrato canónico hasta entonces.

export type WapuCurrencyPayment = "ARS" | "BRL" | "USD"
export type WapuCurrencyTaken = "USDT" | "SAT"
export type WapuTransferType = "fiat_transfer" | "fast_fiat_transfer"
export type WapuFundingMethod = "LIGHTNING" | "USDT"
export type WapuNetwork = "LIGHTNING" | "ETHEREUM" | "POLYGON" | "ARBITRUM"

export interface WapuLoginResponse {
  access_token: string
  [key: string]: unknown
}

export interface WapuApiTokenResponse {
  api_key: string
  [key: string]: unknown
}

export interface WapuApiTokenStatus {
  active: boolean
  [key: string]: unknown
}

export interface WapuHome {
  username: string
  lightning_address?: string
  [key: string]: unknown
}

export interface WapuTentativeAmountInput {
  amount: number
  currency_payment: WapuCurrencyPayment
  currency_taken: WapuCurrencyTaken
  type: WapuTransferType
}

export interface WapuTentativeAmount {
  amount: number
  amount_taken: number // monto en `currency_taken` (p. ej. sats)
  currency_payment: WapuCurrencyPayment
  currency_taken: WapuCurrencyTaken
  expires_at?: string
  [key: string]: unknown
}

export interface WapuDirectFiatTentativeInput {
  amount_ars: number
  type: WapuTransferType
  alias: string
  receiver_name?: string | null
  funding_method: WapuFundingMethod
  network: WapuNetwork
}

export interface WapuDirectFiatTentative {
  tentative_uuid: string
  [key: string]: unknown
}

export interface WapuFunding {
  bolt11: string
  deposit_transaction_id?: string
  [key: string]: unknown
}

export interface WapuTransaction {
  id: string
  status: string
  [key: string]: unknown
}

export interface WapuTransactionList {
  transactions: WapuTransaction[]
  [key: string]: unknown
}

export interface WapuContact {
  id: string
  alias: string
  receiver_name?: string | null
  kind?: string | null
  is_favourite?: boolean
  [key: string]: unknown
}

export interface WapuContactList {
  contacts: WapuContact[]
  [key: string]: unknown
}
