import { describe, expect, it } from "vitest"
import { formatArs, formatScheduleDate } from "./format"

describe("formatArs", () => {
  it("formatea en pesos argentinos", () => {
    // es-AR usa punto como separador de miles; se chequea por partes para
    // no atarse al símbolo/espacios exactos del runtime de Intl.
    const out = formatArs(150000)
    expect(out).toContain("150.000")
    expect(out).toMatch(/\$/)
  })
  it("incluye decimales cuando hay centavos", () => {
    expect(formatArs(1234.5)).toContain("1.234,5")
  })
})

describe("formatScheduleDate", () => {
  it("parsea por partes sin corrimiento de timezone", () => {
    expect(formatScheduleDate("2026-05-20")).toBe("20 de mayo de 2026")
    expect(formatScheduleDate("2026-01-01")).toBe("1 de enero de 2026")
    expect(formatScheduleDate("2024-12-31")).toBe("31 de diciembre de 2024")
  })
  it("null → guion", () => {
    expect(formatScheduleDate(null)).toBe("—")
  })
  it("formato inesperado → devuelve el string tal cual", () => {
    expect(formatScheduleDate("no-es-fecha")).toBe("no-es-fecha")
  })
})
