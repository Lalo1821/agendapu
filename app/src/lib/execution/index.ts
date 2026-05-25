// Orquestador del flujo de pago Wapu + NWC — Fase 4.
//
// Inyección pura: no toca React ni Supabase. La capa de arriba decide cómo
// persistir cada `onStep` (típicamente con updateRun de payment_runs) y cómo
// resolver el `pay` (NWC real o stub).

import { WapuError, type WapuClient } from "@/lib/wapu"
import { NwcError } from "@/lib/nwc/errors"
import type { ScheduledPayment } from "@/lib/supabase/types"

export type PayStep =
  | { step: "quoting" }
  | { step: "tentative_created"; tentativeUuid: string }
  | { step: "funding_issued"; bolt11: string; depositTxId: string }
  | { step: "invoice_paid"; preimage: string }
  | { step: "confirmed"; txId: string }
  | { step: "failed"; error: string }
  | { step: "timeout" }

export interface RunPaymentParams {
  wapu: WapuClient
  pay: (bolt11: string) => Promise<{ preimage: string; feesPaidMsat?: number }>
  scheduled: ScheduledPayment
  onStep: (step: PayStep) => void | Promise<void>
  pollIntervalMs?: number
  timeoutMs?: number
}

export type RunPaymentResult =
  | { status: "confirmed"; txId: string; preimage: string }
  | { status: "failed"; error: string }
  | { status: "timeout" }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runPayment(
  params: RunPaymentParams,
): Promise<RunPaymentResult> {
  const { wapu, pay, scheduled, onStep } = params
  const pollIntervalMs = params.pollIntervalMs ?? 2000
  const timeoutMs = params.timeoutMs ?? 60_000

  try {
    // 1. Cotización (sirve sobre todo para mostrar el monto en sats en la UI).
    await onStep({ step: "quoting" })
    const quote = await wapu.tentativeAmount({
      amount: scheduled.amount_ars,
      currency_payment: "ARS",
      currency_taken: "SAT",
      type: "fiat_transfer",
    })
    console.log("[WAPU-RAW] tentativeAmount", quote)

    // 2. Tentativa direct-fiat — devuelve el UUID con el que se pide el funding.
    const tentative = await wapu.createDirectFiatTentative({
      amount_ars: scheduled.amount_ars,
      type: "fiat_transfer",
      alias: scheduled.contact_alias,
      receiver_name: scheduled.receiver_name,
      funding_method: "LIGHTNING",
      network: "LIGHTNING",
    })
    console.log("[WAPU-RAW] createDirectFiatTentative", tentative)
    await onStep({
      step: "tentative_created",
      tentativeUuid: tentative.tentative_uuid,
    })

    // 3. Funding — Wapu nos devuelve el bolt11 a pagar y el id de la transacción.
    const funding = await wapu.issueFunding(tentative.tentative_uuid)
    console.log("[WAPU-RAW] issueFunding", funding)
    const depositTxId = funding.deposit_transaction_id ?? ""
    await onStep({
      step: "funding_issued",
      bolt11: funding.bolt11,
      depositTxId,
    })

    // 4. Pago Lightning vía NWC (o stub en demos). El preimage es la prueba
    //    criptográfica; lo guardamos pero la verdad final es el status de Wapu.
    const payResult = await pay(funding.bolt11)
    await onStep({ step: "invoice_paid", preimage: payResult.preimage })

    // 5. Polling hasta estado terminal o timeout. Wapu ve la HTLC con un par
    //    de segundos de delay; no hay webhooks así que polling es la única opción.
    const startedAt = Date.now()
    let loggedFirstTx = false
    while (Date.now() - startedAt < timeoutMs) {
      const tx = await wapu.getTransaction(depositTxId)
      if (!loggedFirstTx) {
        console.log("[WAPU-RAW] getTransaction (first poll)", tx)
        loggedFirstTx = true
      }
      if (tx.status === "CONFIRMED") {
        await onStep({ step: "confirmed", txId: tx.id })
        return {
          status: "confirmed",
          txId: tx.id,
          preimage: payResult.preimage,
        }
      }
      if (tx.status === "CANCELED") {
        const error = `Transacción cancelada por Wapu (id ${tx.id})`
        await onStep({ step: "failed", error })
        return { status: "failed", error }
      }
      await sleep(pollIntervalMs)
    }
    await onStep({ step: "timeout" })
    return { status: "timeout" }
  } catch (err) {
    if (err instanceof WapuError || err instanceof NwcError) {
      const error =
        err instanceof NwcError ? `${err.kind}: ${err.message}` : err.message
      await onStep({ step: "failed", error })
      return { status: "failed", error }
    }
    throw err
  }
}
