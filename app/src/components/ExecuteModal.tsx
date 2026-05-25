import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckIcon, CircleIcon, Loader2Icon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useKey } from "@/lib/crypto/KeyContext"
import { formatArs } from "@/lib/format"
import { updatePayment } from "@/lib/payments"
import { nextRunAfter, toISODate } from "@/lib/schedule"
import { runPayment, type PayStep } from "@/lib/execution"
import { startRun, updateRun } from "@/lib/payment_runs"
import {
  createMockWapuClient,
  createWapuClient,
  getWapuToken,
  WapuError,
  type WapuClient,
} from "@/lib/wapu"
import { getNwcConnection, NwcError, payInvoice } from "@/lib/nwc"
import type { ScheduledPayment } from "@/lib/supabase/types"

export type ExecuteModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: ScheduledPayment
  userId: string
  /** Usa createMockWapuClient() y stubea NWC. Pensado para demos sin token real. */
  mock?: boolean
}

type Phase =
  | { name: "loading" }
  | { name: "quote-ready"; sats: number }
  | { name: "running"; stepIndex: number; sats: number }
  | { name: "success" }
  | { name: "error"; message: string }

// La UI muestra 4 pasos; el `quoting` de runPayment ya pasó antes de confirmar.
const STEPS = [
  "Creando tentativa…",
  "Emitiendo invoice…",
  "Pagando desde tu wallet…",
  "Confirmando con Wapu…",
] as const

const NWC_KIND_LABELS: Record<string, string> = {
  insufficient_balance: "Saldo insuficiente en tu wallet",
  user_rejected: "Pago rechazado por la wallet",
  wallet_offline: "Tu wallet está offline",
  timeout: "El pago tardó demasiado. Podés reintentar.",
  unknown: "Tu wallet devolvió un error inesperado",
}

function mapErrorToMessage(err: unknown): string {
  if (err instanceof NwcError) return NWC_KIND_LABELS[err.kind] ?? err.message
  if (err instanceof WapuError) return err.message
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

// runPayment serializa NwcError como `${kind}: ${message}` y WapuError como `message`.
// Recuperamos el `kind` cuando podamos para mostrar copy curado.
function mapFailedString(s: string): string {
  const idx = s.indexOf(":")
  if (idx > 0) {
    const kind = s.slice(0, idx)
    if (kind in NWC_KIND_LABELS) return NWC_KIND_LABELS[kind]
  }
  return s
}

const numberFormatter = new Intl.NumberFormat("es-AR")

export function ExecuteModal({
  open,
  onOpenChange,
  payment,
  userId,
  mock = false,
}: ExecuteModalProps) {
  const { key } = useKey()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ name: "loading" })
  const [retryCount, setRetryCount] = useState(0)
  const wapuRef = useRef<WapuClient | null>(null)
  const nwcConnRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (!key) {
      onOpenChange(false)
      navigate("/login")
      return
    }

    let cancelled = false
    setPhase({ name: "loading" })

    ;(async () => {
      try {
        let wapu: WapuClient
        let conn: string
        if (mock) {
          wapu = createMockWapuClient()
          conn = "mock"
        } else {
          const token = await getWapuToken(userId, key)
          if (!token) throw new Error("No se encontró tu API key de Wapu")
          const stored = await getNwcConnection(userId, key)
          if (!stored) throw new Error("No se encontró tu conexión Lightning")
          wapu = createWapuClient({ apiKey: token })
          conn = stored
        }
        if (cancelled) return
        wapuRef.current = wapu
        nwcConnRef.current = conn

        const quote = await wapu.tentativeAmount({
          amount: payment.amount_ars,
          currency_payment: "ARS",
          currency_taken: "SAT",
          type: "fiat_transfer",
        })
        if (cancelled) return
        setPhase({ name: "quote-ready", sats: quote.amount_taken })
      } catch (e) {
        if (cancelled) return
        setPhase({ name: "error", message: mapErrorToMessage(e) })
      }
    })()

    return () => {
      cancelled = true
    }
    // retryCount fuerza re-ejecución cuando el usuario aprieta "Reintentar".
  }, [open, key, mock, userId, payment.amount_ars, retryCount, navigate, onOpenChange])

  useEffect(() => {
    if (!open) {
      wapuRef.current = null
      nwcConnRef.current = null
    }
  }, [open])

  async function confirmAndRun(sats: number) {
    const wapu = wapuRef.current
    const conn = nwcConnRef.current
    if (!wapu || !conn) {
      setPhase({ name: "error", message: "No se inicializó el cliente" })
      return
    }
    setPhase({ name: "running", stepIndex: 0, sats })

    let runId: string
    try {
      const run = await startRun(userId, payment.id, payment.amount_ars)
      runId = run.id
    } catch (e) {
      setPhase({ name: "error", message: mapErrorToMessage(e) })
      return
    }

    const onStep = async (step: PayStep) => {
      switch (step.step) {
        case "quoting":
          return
        case "tentative_created":
          setPhase({ name: "running", stepIndex: 1, sats })
          await updateRun(userId, runId, {
            status: "tentative_created",
            tentative_uuid: step.tentativeUuid,
          })
          return
        case "funding_issued":
          setPhase({ name: "running", stepIndex: 2, sats })
          await updateRun(userId, runId, {
            status: "funding_issued",
            invoice_bolt11: step.bolt11,
            wapu_tx_id: step.depositTxId,
          })
          return
        case "invoice_paid":
          setPhase({ name: "running", stepIndex: 3, sats })
          await updateRun(userId, runId, {
            status: "invoice_paid",
            sats_paid_estimate: 0,
          })
          return
        case "confirmed":
          await updateRun(userId, runId, {
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
          })
          return
        case "failed":
          await updateRun(userId, runId, {
            status: "failed",
            error_message: step.error,
          })
          return
        case "timeout":
          await updateRun(userId, runId, { status: "timeout" })
          return
      }
    }

    const pay = mock
      ? async (_bolt11: string) => ({ preimage: "mock-preimage" })
      : (bolt11: string) => payInvoice(conn, bolt11)

    try {
      const result = await runPayment({ wapu, pay, scheduled: payment, onStep })

      if (result.status === "confirmed") {
        const next = nextRunAfter(
          {
            frequency: payment.frequency as "monthly" | "weekly",
            dayOfMonth: payment.day_of_month,
            weekday: payment.weekday,
          },
          new Date(),
        )
        await updatePayment(userId, payment.id, { next_run: toISODate(next) })
        setPhase({ name: "success" })
      } else if (result.status === "timeout") {
        setPhase({ name: "error", message: NWC_KIND_LABELS.timeout })
      } else {
        setPhase({ name: "error", message: mapFailedString(result.error) })
      }
    } catch (e) {
      // Errores no atrapados por runPayment (p.ej. Supabase de updateRun).
      setPhase({ name: "error", message: mapErrorToMessage(e) })
    }
  }

  const running = phase.name === "running"

  const handleOpenChange = (next: boolean) => {
    // Bloquear cierre mientras se ejecuta el pago — evita orfanar un run.
    if (!next && running) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!running}>
        <DialogHeader>
          <DialogTitle>Pagar ahora</DialogTitle>
          <DialogDescription>
            {payment.receiver_name ?? payment.contact_alias} ·{" "}
            {formatArs(Number(payment.amount_ars))}
          </DialogDescription>
        </DialogHeader>

        {phase.name === "loading" && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Cotizando con Wapu…
          </div>
        )}

        {phase.name === "quote-ready" && (
          <div className="flex flex-col gap-2 py-2 text-sm">
            <p>
              Vas a pagar{" "}
              <span className="font-medium">
                {formatArs(Number(payment.amount_ars))}
              </span>{" "}
              ≈{" "}
              <span className="font-medium">
                {numberFormatter.format(phase.sats)} sats
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              La cotización vence en unos minutos. Confirmá para emitir la
              invoice y pagar desde tu wallet.
            </p>
          </div>
        )}

        {phase.name === "running" && (
          <ol className="flex flex-col gap-2 py-2 text-sm">
            {STEPS.map((label, i) => {
              const status =
                i < phase.stepIndex
                  ? "done"
                  : i === phase.stepIndex
                    ? "active"
                    : "pending"
              return (
                <li key={label} className="flex items-center gap-2">
                  {status === "done" && (
                    <CheckIcon className="size-4 text-primary" />
                  )}
                  {status === "active" && (
                    <Loader2Icon className="size-4 animate-spin text-primary" />
                  )}
                  {status === "pending" && (
                    <CircleIcon className="size-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      status === "pending"
                        ? "text-muted-foreground"
                        : status === "done"
                          ? "text-muted-foreground line-through"
                          : "font-medium"
                    }
                  >
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        {phase.name === "success" && (
          <Alert>
            <CheckIcon />
            <AlertDescription>
              Pago confirmado por Wapu. El próximo pago se reprogramó
              automáticamente.
            </AlertDescription>
          </Alert>
        )}

        {phase.name === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{phase.message}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {phase.name === "quote-ready" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => confirmAndRun(phase.sats)}>
                Confirmar pago
              </Button>
            </>
          )}
          {phase.name === "success" && (
            <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
          )}
          {phase.name === "error" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              <Button onClick={() => setRetryCount((c) => c + 1)}>
                Reintentar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
