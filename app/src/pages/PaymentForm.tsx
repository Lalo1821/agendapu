import { useEffect, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession } from "@/lib/auth/useSession"
import {
  createScheduledPayment,
  getScheduledPayment,
  paymentInputSchema,
  updateScheduledPayment,
  type PaymentInput,
} from "@/lib/payments"
import { WEEKDAY_LABELS } from "@/lib/schedule"

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export function PaymentForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const sessionState = useSession()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loadingRow, setLoadingRow] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentInputSchema),
    defaultValues: {
      contactAlias: "",
      receiverName: "",
      frequency: "monthly",
      dayOfMonth: 1,
      weekday: null,
    },
  })

  const userId =
    sessionState.status === "authenticated" ? sessionState.session.user.id : null
  const frequency = useWatch({ control, name: "frequency" })

  useEffect(() => {
    if (!isEdit || !userId || !id) return
    let active = true
    getScheduledPayment(userId, id)
      .then((row) => {
        if (!active) return
        if (!row) {
          setNotFound(true)
          return
        }
        reset({
          contactAlias: row.contact_alias,
          receiverName: row.receiver_name ?? "",
          amountArs: Number(row.amount_ars),
          frequency: row.frequency as "monthly" | "weekly",
          dayOfMonth: row.day_of_month,
          weekday: row.weekday,
        })
      })
      .catch((err) =>
        setSubmitError(err instanceof Error ? err.message : "No se pudo cargar"),
      )
      .finally(() => active && setLoadingRow(false))
    return () => {
      active = false
    }
  }, [isEdit, userId, id, reset])

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

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      if (isEdit && id) {
        await updateScheduledPayment(userId, id, values)
        navigate(`/payments/${id}`, { replace: true })
      } else {
        const created = await createScheduledPayment(userId, values)
        navigate(`/payments/${created.id}`, { replace: true })
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "No se pudo guardar el pago",
      )
    }
  })

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Editar pago" : "Nuevo pago programado"}</CardTitle>
          <CardDescription>
            Definí a quién le pagás, cuánto y cada cuánto. El pago se ejecuta
            cuando vos lo aprobás el día que toca.
          </CardDescription>
        </CardHeader>

        {loadingRow ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">Cargando pago…</p>
          </CardContent>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contactAlias">Alias o destinatario</Label>
                <Input
                  id="contactAlias"
                  placeholder="alquiler.mp / CBU alias"
                  aria-invalid={!!errors.contactAlias}
                  {...register("contactAlias")}
                />
                {errors.contactAlias && (
                  <p className="text-xs text-destructive">
                    {errors.contactAlias.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="receiverName">Nombre (opcional)</Label>
                <Input
                  id="receiverName"
                  placeholder="Ej: Inmobiliaria López"
                  aria-invalid={!!errors.receiverName}
                  {...register("receiverName")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amountArs">Monto (ARS)</Label>
                <Input
                  id="amountArs"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="150000"
                  aria-invalid={!!errors.amountArs}
                  {...register("amountArs", { valueAsNumber: true })}
                />
                {errors.amountArs && (
                  <p className="text-xs text-destructive">
                    {errors.amountArs.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Frecuencia</Label>
                <Controller
                  control={control}
                  name="frequency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Frecuencia">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensual</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {frequency === "monthly" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Día del mes</Label>
                  <Controller
                    control={control}
                    name="dayOfMonth"
                    render={({ field }) => (
                      <Select
                        value={field.value != null ? String(field.value) : ""}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <SelectTrigger aria-label="Día del mes">
                          <SelectValue placeholder="Elegí un día" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((day) => (
                            <SelectItem key={day} value={String(day)}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si el mes es más corto (ej: 31 en febrero), se cobra el
                    último día.
                  </p>
                  {errors.dayOfMonth && (
                    <p className="text-xs text-destructive">
                      {errors.dayOfMonth.message}
                    </p>
                  )}
                </div>
              )}

              {frequency === "weekly" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Día de la semana</Label>
                  <Controller
                    control={control}
                    name="weekday"
                    render={({ field }) => (
                      <Select
                        value={field.value != null ? String(field.value) : ""}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <SelectTrigger aria-label="Día de la semana">
                          <SelectValue placeholder="Elegí un día" />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAY_LABELS.map((label, i) => (
                            <SelectItem key={label} value={String(i)}>
                              <span className="capitalize">{label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.weekday && (
                    <p className="text-xs text-destructive">
                      {errors.weekday.message}
                    </p>
                  )}
                </div>
              )}

              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() =>
                  navigate(isEdit && id ? `/payments/${id}` : "/dashboard")
                }
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting
                  ? "Guardando…"
                  : isEdit
                    ? "Guardar cambios"
                    : "Crear pago"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
