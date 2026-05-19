// CRUD de pagos programados — Fase 3.
//
// La fila guarda el `next_run` ya calculado (columna `date`). Se recalcula
// en cada create/update y al reanudar un pago pausado, para que el dashboard
// de Fase 4 solo tenga que leer `next_run <= hoy`.

import { z } from "zod"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/lib/supabase"
import { nextRun, toISODate, type ScheduleSpec } from "@/lib/schedule"

export type ScheduledPayment =
  Database["public"]["Tables"]["scheduled_payments"]["Row"]

// Esquema compartido entre el form (react-hook-form) y la capa de datos:
// una sola fuente de verdad para la validación.
export const paymentInputSchema = z
  .object({
    contactAlias: z
      .string()
      .trim()
      .min(1, "Ingresá el alias o destinatario")
      .max(120, "Demasiado largo"),
    receiverName: z
      .string()
      .trim()
      .max(120, "Demasiado largo")
      .optional()
      .or(z.literal("")),
    amountArs: z
      .number({ message: "Ingresá un monto" })
      .positive("El monto debe ser mayor a 0")
      .max(99_999_999_999, "Monto demasiado grande"),
    frequency: z.enum(["monthly", "weekly"], {
      message: "Elegí una frecuencia",
    }),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    weekday: z.number().int().min(0).max(6).nullable().optional(),
  })
  .refine((v) => v.frequency !== "monthly" || v.dayOfMonth != null, {
    message: "Elegí el día del mes",
    path: ["dayOfMonth"],
  })
  .refine((v) => v.frequency !== "weekly" || v.weekday != null, {
    message: "Elegí el día de la semana",
    path: ["weekday"],
  })

export type PaymentInput = z.infer<typeof paymentInputSchema>

function specOf(input: {
  frequency: "monthly" | "weekly"
  dayOfMonth?: number | null
  weekday?: number | null
}): ScheduleSpec {
  return {
    frequency: input.frequency,
    dayOfMonth: input.dayOfMonth ?? null,
    weekday: input.weekday ?? null,
  }
}

function toRowFields(input: PaymentInput, from: Date) {
  return {
    contact_alias: input.contactAlias.trim(),
    receiver_name: input.receiverName?.trim() ? input.receiverName.trim() : null,
    amount_ars: input.amountArs,
    frequency: input.frequency,
    // Solo el campo relevante a la frecuencia; el otro queda null (el CHECK
    // de la DB exige que el de la frecuencia elegida no sea null).
    day_of_month: input.frequency === "monthly" ? input.dayOfMonth! : null,
    weekday: input.frequency === "weekly" ? input.weekday! : null,
    next_run: toISODate(nextRun(specOf(input), from)),
  }
}

export async function createScheduledPayment(
  userId: string,
  input: PaymentInput,
  from: Date = new Date(),
): Promise<ScheduledPayment> {
  const { data, error } = await supabase
    .from("scheduled_payments")
    .insert({ user_id: userId, ...toRowFields(input, from) })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listScheduledPayments(
  userId: string,
): Promise<ScheduledPayment[]> {
  const { data, error } = await supabase
    .from("scheduled_payments")
    .select("*")
    .eq("user_id", userId)
    .order("paused", { ascending: true })
    .order("next_run", { ascending: true, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function getScheduledPayment(
  userId: string,
  id: string,
): Promise<ScheduledPayment | null> {
  const { data, error } = await supabase
    .from("scheduled_payments")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateScheduledPayment(
  userId: string,
  id: string,
  input: PaymentInput,
  from: Date = new Date(),
): Promise<ScheduledPayment> {
  const { data, error } = await supabase
    .from("scheduled_payments")
    .update(toRowFields(input, from))
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Pausa o reanuda. Al reanudar se recalcula `next_run` desde hoy: si el
 * pago estuvo pausado meses, no queremos que dispare contra una fecha vieja.
 */
export async function setPaused(
  userId: string,
  id: string,
  paused: boolean,
  from: Date = new Date(),
): Promise<ScheduledPayment> {
  const patch: Database["public"]["Tables"]["scheduled_payments"]["Update"] = {
    paused,
  }

  if (!paused) {
    const current = await getScheduledPayment(userId, id)
    if (!current) throw new Error("El pago no existe")
    patch.next_run = toISODate(
      nextRun(
        specOf({
          frequency: current.frequency as "monthly" | "weekly",
          dayOfMonth: current.day_of_month,
          weekday: current.weekday,
        }),
        from,
      ),
    )
  }

  const { data, error } = await supabase
    .from("scheduled_payments")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteScheduledPayment(
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("scheduled_payments")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
  if (error) throw error
}
