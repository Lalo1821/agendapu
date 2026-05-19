import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { signOut } from "@/lib/auth"
import { useSession } from "@/lib/auth/useSession"
import { useKey } from "@/lib/crypto/KeyContext"
import { listScheduledPayments, type ScheduledPayment } from "@/lib/payments"
import { describeSchedule } from "@/lib/schedule"
import { formatArs, formatScheduleDate } from "@/lib/format"

export function Dashboard() {
  const navigate = useNavigate()
  const state = useSession()
  const { lock } = useKey()

  const [payments, setPayments] = useState<ScheduledPayment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const userId =
    state.status === "authenticated" ? state.session.user.id : null

  useEffect(() => {
    if (!userId) return
    let active = true
    listScheduledPayments(userId)
      .then((rows) => active && setPayments(rows))
      .catch(
        (e) =>
          active &&
          setError(e instanceof Error ? e.message : "No se pudieron cargar"),
      )
    return () => {
      active = false
    }
  }, [userId])

  const handleSignOut = async () => {
    lock()
    await signOut()
    navigate("/login", { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">AgendaPu</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/health">Estado</Link>
          </Button>
          <Button variant="outline" onClick={handleSignOut}>
            Salir
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Pagos programados</h2>
        <Button asChild>
          <Link to="/payments/new">Nuevo pago</Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {payments === null && !error && (
        <p className="text-sm text-muted-foreground">Cargando pagos…</p>
      )}

      {payments !== null && payments.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no tenés pagos</CardTitle>
            <CardDescription>
              Agendá tu primer pago recurrente en pesos. Lo fondeás desde tu
              wallet Lightning el día que toca, vos lo aprobás.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/payments/new">Crear primer pago</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {payments?.map((p) => (
        <Link key={p.id} to={`/payments/${p.id}`} className="block">
          <Card className="transition-colors hover:border-ring">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {p.receiver_name ?? p.contact_alias}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {describeSchedule({
                    frequency: p.frequency as "monthly" | "weekly",
                    dayOfMonth: p.day_of_month,
                    weekday: p.weekday,
                  })}
                  {" · "}
                  {p.paused
                    ? "Pausado"
                    : `Próximo: ${formatScheduleDate(p.next_run)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-heading text-base">
                  {formatArs(Number(p.amount_ars))}
                </span>
                {p.paused && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Pausado
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}

      <p className="text-xs text-muted-foreground">
        Sesión: {state.status === "authenticated" ? state.session.user.email : "—"}
      </p>
    </div>
  )
}
