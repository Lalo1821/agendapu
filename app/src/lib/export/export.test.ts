import { describe, expect, it } from "vitest"
import { exportToCSV, exportToJSON, type ExportableRun } from "./index"

const sample: ExportableRun[] = [
  {
    startedAt: "2026-05-20T15:30:00.000Z",
    contact: "Juan Pérez",
    arsAmount: 150000,
    satsPaid: 12345,
    status: "confirmed",
    errorMessage: null,
  },
  {
    startedAt: "2026-05-21T10:00:00.000Z",
    contact: "Acme, S.A.",
    arsAmount: 5000,
    satsPaid: null,
    status: "failed",
    errorMessage: 'Wallet "offline"',
  },
]

describe("exportToCSV", () => {
  it("emite header en español aun con lista vacía", () => {
    expect(exportToCSV([])).toBe(
      "Fecha,Contacto,Monto (ARS),Sats pagados,Estado,Error",
    )
  })

  it("serializa un run completo", () => {
    const csv = exportToCSV([sample[0]])
    const lines = csv.split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe(
      "2026-05-20T15:30:00.000Z,Juan Pérez,150000,12345,confirmed,",
    )
  })

  it("escapa comas y comillas según RFC 4180", () => {
    const csv = exportToCSV([sample[1]])
    const lines = csv.split("\n")
    expect(lines[1]).toBe(
      '2026-05-21T10:00:00.000Z,"Acme, S.A.",5000,,failed,"Wallet ""offline"""',
    )
  })

  it("deja la celda sats vacía cuando es null", () => {
    const csv = exportToCSV([sample[1]])
    // Tres comas seguidas: monto, (sats vacío), status.
    expect(csv).toContain("5000,,failed")
  })

  it("escapa también un salto de línea dentro del contacto", () => {
    const csv = exportToCSV([
      { ...sample[0], contact: "Línea 1\nLínea 2" },
    ])
    expect(csv.split("\n").length).toBeGreaterThan(2) // por el \n embebido
    expect(csv).toContain('"Línea 1\nLínea 2"')
  })
})

describe("exportToJSON", () => {
  it("devuelve '[]' para lista vacía", () => {
    expect(exportToJSON([])).toBe("[]")
  })

  it("usa pretty-print con 2 espacios", () => {
    const json = exportToJSON([sample[0]])
    // Array → objeto anidado: 2 espacios por el array + 2 por el objeto.
    expect(json.startsWith("[\n  {\n    \"startedAt\"")).toBe(true)
  })

  it("round-trip preserva los datos", () => {
    expect(JSON.parse(exportToJSON(sample))).toEqual(sample)
  })
})
