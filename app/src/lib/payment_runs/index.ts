// Bitácora de cada intento de cobro automatizado — Fase 4.
//
// El runner crea una fila por intento (`startRun`) y la va actualizando con
// los eventos de Wapu/NWC (`updateRun`). El historial se consume desde el
// dashboard via `listRuns`.

import { supabase } from "@/lib/supabase"
import type { Database } from "@/lib/supabase"

export type PaymentRun = Database["public"]["Tables"]["payment_runs"]["Row"]
type PaymentRunUpdate = Database["public"]["Tables"]["payment_runs"]["Update"]

export async function startRun(
  userId: string,
  scheduledPaymentId: string,
  arsAmount: number,
): Promise<PaymentRun> {
  const { data, error } = await supabase
    .from("payment_runs")
    .insert({
      user_id: userId,
      scheduled_payment_id: scheduledPaymentId,
      ars_amount: arsAmount,
      status: "pending",
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRun(
  userId: string,
  runId: string,
  patch: PaymentRunUpdate,
): Promise<PaymentRun> {
  const { data, error } = await supabase
    .from("payment_runs")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", runId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listRuns(
  userId: string,
  scheduledPaymentId?: string,
): Promise<PaymentRun[]> {
  let query = supabase
    .from("payment_runs")
    .select("*")
    .eq("user_id", userId)
  if (scheduledPaymentId) {
    query = query.eq("scheduled_payment_id", scheduledPaymentId)
  }
  const { data, error } = await query.order("started_at", { ascending: false })
  if (error) throw error
  return data ?? []
}
