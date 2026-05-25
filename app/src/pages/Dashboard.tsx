import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ExecuteModal } from "@/components/ExecuteModal"
import { signOut } from "@/lib/auth"
import { useSession } from "@/lib/auth/useSession"
import { useKey } from "@/lib/crypto/KeyContext"
import { listScheduledPayments, type ScheduledPayment } from "@/lib/payments"
import { describeSchedule } from "@/lib/schedule"
import { formatArs, formatScheduleDate } from "@/lib/format"
import { getNwcBalance, getNwcConnection, NwcError } from "@/lib/nwc"

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTH_LABELS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

// Fallback de cotización para el demo. Se usa solo si la wallet devuelve balance;
// no pretendemos precio en vivo en el MVP. ~70M ARS/BTC (≈ 0.7 ARS/sat).
const ARS_PER_SAT_FALLBACK = 0.7

const numberFormatter = new Intl.NumberFormat("es-AR")

/** YYYY-MM-DD de hoy en la zona local del navegador. */
function todayLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function Dashboard() {
  const navigate = useNavigate()
  const state = useSession()
  const { key, lock } = useKey()
  const [searchParams] = useSearchParams()
  const mock = searchParams.get("mock") === "1"

  const [payments, setPayments] = useState<ScheduledPayment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

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
  }, [userId, reloadTick])

  const handleSignOut = async () => {
    lock()
    await signOut()
    navigate("/login", { replace: true })
  }

  const today = todayLocalISO()

  const dueToday = useMemo(
    () =>
      (payments ?? []).filter(
        (p) => !p.paused && p.next_run !== null && p.next_run <= today,
      ),
    [payments, today],
  )

  const executingPayment = useMemo(
    () => (executingId ? (payments ?? []).find((p) => p.id === executingId) ?? null : null),
    [executingId, payments],
  )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">AgendaPu</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/history">Histórico</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/health">Estado</Link>
          </Button>
          <Button variant="outline" onClick={handleSignOut}>
            Salir
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {userId && key && <BalanceCard userId={userId} cryptoKey={key} />}

      <DueTodayCard
        payments={dueToday}
        loading={payments === null && !error}
        onExecute={(id) => setExecutingId(id)}
      />

      <MonthCalendarCard payments={payments ?? []} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Pagos programados</h2>
        <Button asChild>
          <Link to="/payments/new">Nuevo pago</Link>
        </Button>
      </div>

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

      {userId && executingPayment && (
        <ExecuteModal
          open
          onOpenChange={(next) => {
            if (next) return
            setExecutingId(null)
            // Refresca tras cualquier cierre: si el pago salió OK, el next_run
            // avanzó; si no, no pasa nada (idempotente, una query barata).
            setReloadTick((t) => t + 1)
          }}
          payment={executingPayment}
          userId={userId}
          mock={mock}
        />
      )}
    </div>
  )
}

function DueTodayCard({
  payments,
  loading,
  onExecute,
}: {
  payments: ScheduledPayment[]
  loading: boolean
  onExecute: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos de hoy</CardTitle>
        <CardDescription>
          Pagos cuya fecha programada ya llegó. Confirmá uno por uno desde tu
          wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loading && (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        )}
        {!loading && payments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay pagos pendientes para hoy.
          </p>
        )}
        {payments.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {p.receiver_name ?? p.contact_alias}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {formatArs(Number(p.amount_ars))}
              </p>
            </div>
            <Button size="sm" onClick={() => onExecute(p.id)}>
              Pagar ahora
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function MonthCalendarCard({ payments }: { payments: ScheduledPayment[] }) {
  const navigate = useNavigate()
  const now = new Date()
  const year = now.getFullYear()
  const monthIdx = now.getMonth()
  const monthLabel = MONTH_LABELS_ES[monthIdx]
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  // getDay: 0=Dom..6=Sáb. Queremos lunes como primer día → offset 0..6 con lunes=0.
  const firstDow = new Date(year, monthIdx, 1).getDay()
  const leading = (firstDow + 6) % 7

  const monthPrefix = `${year}-${String(monthIdx + 1).padStart(2, "0")}-`
  const byDay = useMemo(() => {
    const map = new Map<number, ScheduledPayment[]>()
    for (const p of payments) {
      if (p.paused || !p.next_run || !p.next_run.startsWith(monthPrefix)) continue
      const day = Number(p.next_run.slice(8, 10))
      const list = map.get(day) ?? []
      list.push(p)
      map.set(day, list)
    }
    return map
  }, [payments, monthPrefix])

  const cells: Array<{ day: number | null }> = []
  for (let i = 0; i < leading; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })

  const todayDay = now.getDate()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">
          {monthLabel} {year}
        </CardTitle>
        <CardDescription>
          Los días con un punto naranja tienen pagos programados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WEEKDAY_HEADERS.map((h) => (
            <div key={h} className="py-1 font-medium text-muted-foreground">
              {h}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (cell.day === null) return <div key={`b${i}`} />
            const marked = byDay.get(cell.day)
            const isToday = cell.day === todayDay
            const className = [
              "relative flex aspect-square items-center justify-center rounded-md border text-sm transition-colors",
              isToday
                ? "border-primary bg-primary/5 font-medium"
                : "border-border",
              marked
                ? "cursor-pointer hover:border-ring"
                : "text-muted-foreground",
            ].join(" ")
            const content = (
              <>
                {cell.day}
                {marked && (
                  <span className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-orange-500" />
                )}
              </>
            )
            if (marked) {
              return (
                <button
                  key={cell.day}
                  type="button"
                  className={className}
                  onClick={() => navigate(`/payments/${marked[0].id}`)}
                  aria-label={`${marked.length} pago(s) el ${cell.day}`}
                >
                  {content}
                </button>
              )
            }
            return (
              <div key={cell.day} className={className}>
                {content}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

type BalanceState =
  | { status: "loading" }
  | { status: "no-wallet" }
  | { status: "ready"; sats: number }
  | { status: "error" }

function BalanceCard({ userId, cryptoKey }: { userId: string; cryptoKey: CryptoKey }) {
  const [state, setState] = useState<BalanceState>({ status: "loading" })

  useEffect(() => {
    let active = true
    setState({ status: "loading" })
    ;(async () => {
      try {
        const conn = await getNwcConnection(userId, cryptoKey)
        if (!active) return
        if (!conn) {
          setState({ status: "no-wallet" })
          return
        }
        const { balanceSats } = await getNwcBalance(conn)
        if (!active) return
        setState({ status: "ready", sats: balanceSats })
      } catch (e) {
        if (!active) return
        // NwcError u otros: degradamos silenciosamente, no rompemos dashboard.
        void (e instanceof NwcError)
        setState({ status: "error" })
      }
    })()
    return () => {
      active = false
    }
  }, [userId, cryptoKey])

  if (state.status === "no-wallet") return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance Lightning</CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === "loading" && (
          <p className="text-sm text-muted-foreground">Consultando wallet…</p>
        )}
        {state.status === "error" && (
          <p className="text-sm text-muted-foreground">Balance no disponible</p>
        )}
        {state.status === "ready" && (
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-2xl">
              {numberFormatter.format(state.sats)} sats
            </span>
            <span className="text-sm text-muted-foreground">
              ≈ {formatArs(Math.round(state.sats * ARS_PER_SAT_FALLBACK))}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
