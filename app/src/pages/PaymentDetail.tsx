import { useEffect, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSession } from "@/lib/auth/useSession"
import {
  deleteScheduledPayment,
  getScheduledPayment,
  setPaused,
  type ScheduledPayment,
} from "@/lib/payments"
import { describeSchedule } from "@/lib/schedule"
import { formatArs, formatScheduleDate } from "@/lib/format"

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  )
}

export function PaymentDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const sessionState = useSession()

  const [row, setRow] = useState<ScheduledPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const userId =
    sessionState.status === "authenticated" ? sessionState.session.user.id : null

  useEffect(() => {
    if (!userId || !id) return
    let active = true
    getScheduledPayment(userId, id)
      .then((r) => {
        if (!active) return
        if (r) setRow(r)
        else setNotFound(true)
      })
      .catch(
        (e) =>
          active &&
          setError(e instanceof Error ? e.message : "No se pudo cargar"),
      )
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [userId, id])

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
  if (notFound) return <Navigate to="/dashboard" replace />

  const togglePause = async () => {
    if (!row || !id) return
    setBusy(true)
    setError(null)
    try {
      const updated = await setPaused(userId, id, !row.paused)
      setRow(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!id) return
    setBusy(true)
    setError(null)
    try {
      await deleteScheduledPayment(userId, id)
      navigate("/dashboard", { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar")
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link to="/dashboard">← Volver</Link>
        </Button>
        {row && !row.paused && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Activo
          </span>
        )}
        {row?.paused && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Pausado
          </span>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading
              ? "Cargando…"
              : (row?.receiver_name ?? row?.contact_alias ?? "Pago")}
          </CardTitle>
        </CardHeader>

        {row && (
          <>
            <CardContent className="flex flex-col">
              <Field label="Destinatario" value={row.contact_alias} />
              {row.receiver_name && (
                <Field label="Nombre" value={row.receiver_name} />
              )}
              <Field
                label="Monto"
                value={formatArs(Number(row.amount_ars))}
              />
              <Field
                label="Frecuencia"
                value={describeSchedule({
                  frequency: row.frequency as "monthly" | "weekly",
                  dayOfMonth: row.day_of_month,
                  weekday: row.weekday,
                })}
              />
              <Field
                label="Próximo pago"
                value={
                  row.paused ? "Pausado" : formatScheduleDate(row.next_run)
                }
              />

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex-col gap-2">
              <div className="flex w-full gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link to={`/payments/${row.id}/edit`}>Editar</Link>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={togglePause}
                  disabled={busy}
                >
                  {row.paused ? "Reanudar" : "Pausar"}
                </Button>
              </div>

              {confirmingDelete ? (
                <div className="flex w-full flex-col gap-2 rounded-lg border border-destructive/30 p-3">
                  <p className="text-sm">
                    ¿Borrar este pago programado? No se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={busy}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={remove}
                      disabled={busy}
                    >
                      {busy ? "Borrando…" : "Sí, borrar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                >
                  Borrar pago
                </Button>
              )}
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  )
}
