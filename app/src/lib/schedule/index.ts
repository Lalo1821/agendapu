// Lógica de scheduling (frecuencias, próxima ejecución) — Fase 3.
//
// Todo se calcula en UTC y a nivel de fecha (sin hora) para que sea
// determinista y sin sorpresas de timezone: `scheduled_payments.next_run`
// es un `date` en Postgres y la app apunta a Argentina (UTC-3), pero el
// "día calendario" es lo único que importa. Trabajar en UTC evita que un
// `new Date("2026-05-31")` se corra un día según la zona del navegador.

import type { PaymentFrequency } from "@/lib/supabase"

export interface ScheduleSpec {
  frequency: PaymentFrequency
  /** 1–31. Requerido si frequency === "monthly". */
  dayOfMonth?: number | null
  /** 0 (domingo) – 6 (sábado). Requerido si frequency === "weekly". */
  weekday?: number | null
}

export const WEEKDAY_LABELS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const

/** Días que tiene el mes `month` (0-11) del año `year`. Maneja bisiestos. */
export function daysInMonth(year: number, month: number): number {
  // Día 0 del mes siguiente = último día de este mes.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Fecha → "YYYY-MM-DD" usando las partes UTC (formato de columna `date`). */
export function toISODate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Medianoche UTC del mismo día calendario que `d` (descarta la hora). */
function atUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n))
}

function assertValid(spec: ScheduleSpec): void {
  if (spec.frequency === "monthly") {
    if (spec.dayOfMonth == null || spec.dayOfMonth < 1 || spec.dayOfMonth > 31) {
      throw new Error("Frecuencia mensual: dayOfMonth debe estar entre 1 y 31")
    }
    return
  }
  if (spec.frequency === "weekly") {
    if (spec.weekday == null || spec.weekday < 0 || spec.weekday > 6) {
      throw new Error("Frecuencia semanal: weekday debe estar entre 0 y 6")
    }
    return
  }
  // El enum de DB todavía incluye 'custom' pero el MVP no lo ofrece.
  throw new Error(`Frecuencia "${spec.frequency}" no soportada en el MVP`)
}

/**
 * Próxima fecha de ejecución en o después de `from` (inclusive: si `from`
 * ya cae en la fecha objetivo, devuelve `from`).
 *
 * Mensual con un día que no existe ese mes (ej: 31 en febrero) → último día
 * del mes (28/29). Así nunca se saltea un mes, como en una suscripción.
 */
export function nextRun(spec: ScheduleSpec, from: Date): Date {
  assertValid(spec)
  const base = atUtcMidnight(from)

  if (spec.frequency === "weekly") {
    const delta = (spec.weekday! - base.getUTCDay() + 7) % 7
    return addDays(base, delta)
  }

  // monthly
  const day = spec.dayOfMonth!
  let year = base.getUTCFullYear()
  let month = base.getUTCMonth()

  // Mes actual: si el día (clampeado) todavía no pasó, es este mes.
  const targetThisMonth = Math.min(day, daysInMonth(year, month))
  if (targetThisMonth >= base.getUTCDate()) {
    return new Date(Date.UTC(year, month, targetThisMonth))
  }

  // Si no, el mes que viene (cualquier día del próximo mes es > from).
  month += 1
  if (month > 11) {
    month = 0
    year += 1
  }
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))))
}

/**
 * Próxima ejecución estrictamente después de `after` — para avanzar
 * `next_run` una vez que el pago ya se ejecutó (lo usa Fase 4).
 */
export function nextRunAfter(spec: ScheduleSpec, after: Date): Date {
  return nextRun(spec, addDays(atUtcMidnight(after), 1))
}

/** Texto humano en español para listas y detalle (UX — Gorilator). */
export function describeSchedule(spec: ScheduleSpec): string {
  assertValid(spec)
  if (spec.frequency === "weekly") {
    return `Todos los ${WEEKDAY_LABELS[spec.weekday!]}`
  }
  const d = spec.dayOfMonth!
  if (d >= 29) {
    return `El día ${d} de cada mes (o el último, si el mes es más corto)`
  }
  return `El día ${d} de cada mes`
}

export const FREQUENCY_LABELS: Record<"monthly" | "weekly", string> = {
  monthly: "Mensual",
  weekly: "Semanal",
}
