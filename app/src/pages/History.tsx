// Histórico de payment_runs + exportación — Fase 5.
//
// Lista todos los intentos del usuario agrupados por pago programado. Cruza
// `payment_runs` (cronología) con `scheduled_payments` (nombre del contacto):
// si un pago fue borrado, sus runs igual se muestran bajo "Pago eliminado".

import { useEffect, useMemo, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSession } from "@/lib/auth/useSession"
import { listRuns, type PaymentRun } from "@/lib/payment_runs"
import {
  listScheduledPayments,
  type ScheduledPayment,
} from "@/lib/payments"
import { exportToCSV, exportToJSON, type ExportableRun } from "@/lib/export"
import { formatArs } from "@/lib/format"
import type { PaymentStatus } from "@/lib/supabase/types"

type Filter = "all" | "confirmed" | "failed"

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  tentative_created: "Tentativa creada",
  funding_issued: "Invoice emitida",
  invoice_paid: "Invoice pagada",
  confirmed: "Confirmado",
  failed: "Fallido",
  timeout: "Timeout",
}

function isFailed(status: PaymentStatus): boolean {
  return status === "failed" || status === "timeout"
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function History() {
  const sessionState = useSession()
  const [runs, setRuns] = useState<PaymentRun[] | null>(null)
  const [payments, setPayments] = useState<ScheduledPayment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")

  const userId =
    sessionState.status === "authenticated" ? sessionState.session.user.id : null

  useEffect(() => {
    if (!userId) return
    let active = true
    Promise.all([listRuns(userId), listScheduledPayments(userId)])
      .then(([r, p]) => {
        if (!active) return
        setRuns(r)
        setPayments(p)
      })
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el historial",
          ),
      )
    return () => {
      active = false
    }
  }, [userId])

  const contactById = useMemo(() => {
    const map = new Map<string, ScheduledPayment>()
    for (const p of payments ?? []) map.set(p.id, p)
    return map
  }, [payments])

  const filtered = useMemo(() => {
    if (!runs) return []
    if (filter === "all") return runs
    if (filter === "confirmed")
      return runs.filter((r) => r.status === "confirmed")
    return runs.filter((r) => isFailed(r.status))
  }, [runs, filter])

  const grouped = useMemo(() => {
    const groups = new Map<string, PaymentRun[]>()
    for (const r of filtered) {
      const list = groups.get(r.scheduled_payment_id) ?? []
      list.push(r)
      groups.set(r.scheduled_payment_id, list)
    }
    return Array.from(groups.entries())
  }, [filtered])

  const toExportable = (rows: PaymentRun[]): ExportableRun[] =>
    rows.map((r) => {
      const p = contactById.get(r.scheduled_payment_id)
      const contact = p
        ? (p.receiver_name ?? p.contact_alias)
        : "Pago eliminado"
      return {
        startedAt: r.started_at,
        contact,
        arsAmount: Number(r.ars_amount),
        satsPaid: r.sats_paid_estimate,
        status: r.status,
        errorMessage: r.error_message,
      }
    })

  const handleExportCsv = () => {
    const today = new Date().toISOString().slice(0, 10)
    downloadFile(
      exportToCSV(toExportable(filtered)),
      `agendapu-historico-${today}.csv`,
      "text/csv;charset=utf-8",
    )
  }
  const handleExportJson = () => {
    const today = new Date().toISOString().slice(0, 10)
    downloadFile(
      exportToJSON(toExportable(filtered)),
      `agendapu-historico-${today}.json`,
      "application/json",
    )
  }

  if (sessionState.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    )
  }
  if (sessionState.status !== "authenticated" || !userId) {
    return <Navigate to="/login" replace />
  }

  const loading = runs === null && !error

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Histórico</h1>
        <Button variant="ghost" asChild>
          <Link to="/dashboard">← Volver</Link>
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtros y exportación</CardTitle>
          <CardDescription>
            Filtrá por estado y exportá lo que ves en CSV o JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Todos
            </Button>
            <Button
              variant={filter === "confirmed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("confirmed")}
            >
              Confirmados
            </Button>
            <Button
              variant={filter === "failed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("failed")}
            >
              Fallidos
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
            >
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              disabled={filtered.length === 0}
            >
              Exportar JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <p className="text-sm text-muted-foreground">Cargando intentos…</p>
      )}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sin resultados</CardTitle>
            <CardDescription>
              {filter === "all"
                ? "Todavía no se ejecutó ningún pago."
                : "Ningún intento coincide con este filtro."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {grouped.map(([scheduledId, rows]) => {
        const p = contactById.get(scheduledId)
        const title = p
          ? (p.receiver_name ?? p.contact_alias)
          : "Pago eliminado"
        return (
          <Card key={scheduledId}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                {rows.length} {rows.length === 1 ? "intento" : "intentos"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {formatTimestamp(r.started_at)}
                    </p>
                    {r.error_message && (
                      <p className="truncate text-xs text-destructive">
                        {r.error_message}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm">
                      {formatArs(Number(r.ars_amount))}
                    </span>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs " +
                        (r.status === "confirmed"
                          ? "bg-primary/10 text-primary"
                          : isFailed(r.status)
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
