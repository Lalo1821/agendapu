// Formateo para UI. Las fechas son strings "YYYY-MM-DD" de columnas `date`:
// se parsean por partes (no `new Date(iso)`) para no correrse un día según
// la timezone del navegador.

const MONTHS_ES = [
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

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
})

export function formatArs(amount: number): string {
  return arsFormatter.format(amount)
}

/** "2026-05-20" → "20 de mayo de 2026". `null` → "—". */
export function formatScheduleDate(iso: string | null): string {
  if (!iso) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  const monthName = MONTHS_ES[Number(mo) - 1]
  if (!monthName) return iso
  return `${Number(d)} de ${monthName} de ${y}`
}
