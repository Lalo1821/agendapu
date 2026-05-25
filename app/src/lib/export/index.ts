// Export CSV / JSON del histórico — Fase 5.
//
// Capa pura: la página arma el shape plano (`ExportableRun`) a partir de los
// runs + lookup de contactos, y este módulo se encarga del formato. Así los
// tests no necesitan mockear Supabase.

import type { PaymentStatus } from "@/lib/supabase/types"

export interface ExportableRun {
  /** ISO timestamp del intento (started_at). */
  startedAt: string
  /** Nombre legible: receiver_name ?? contact_alias. */
  contact: string
  arsAmount: number
  satsPaid: number | null
  status: PaymentStatus
  errorMessage: string | null
}

const CSV_HEADERS = [
  "Fecha",
  "Contacto",
  "Monto (ARS)",
  "Sats pagados",
  "Estado",
  "Error",
] as const

// RFC 4180: si el campo contiene coma, comilla o salto de línea, va envuelto
// en comillas y las comillas internas se duplican.
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function rowToCsv(run: ExportableRun): string {
  const cells = [
    run.startedAt,
    run.contact,
    String(run.arsAmount),
    run.satsPaid === null ? "" : String(run.satsPaid),
    run.status,
    run.errorMessage ?? "",
  ]
  return cells.map(escapeCsvField).join(",")
}

export function exportToCSV(runs: ExportableRun[]): string {
  const lines = [CSV_HEADERS.map(escapeCsvField).join(",")]
  for (const r of runs) lines.push(rowToCsv(r))
  return lines.join("\n")
}

export function exportToJSON(runs: ExportableRun[]): string {
  return JSON.stringify(runs, null, 2)
}
