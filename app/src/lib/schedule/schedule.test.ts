import { describe, expect, it } from "vitest"
import {
  daysInMonth,
  describeSchedule,
  nextRun,
  nextRunAfter,
  toISODate,
  type ScheduleSpec,
} from "./index"

// Helper: fecha UTC a nivel día.
const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (spec: ScheduleSpec, from: string) => toISODate(nextRun(spec, d(from)))

describe("daysInMonth", () => {
  it("meses estándar", () => {
    expect(daysInMonth(2026, 0)).toBe(31) // enero
    expect(daysInMonth(2026, 3)).toBe(30) // abril
  })
  it("febrero no bisiesto vs bisiesto", () => {
    expect(daysInMonth(2026, 1)).toBe(28)
    expect(daysInMonth(2024, 1)).toBe(29)
    expect(daysInMonth(2000, 1)).toBe(29) // divisible por 400
    expect(daysInMonth(1900, 1)).toBe(28) // divisible por 100 pero no 400
  })
})

describe("toISODate", () => {
  it("formatea con cero a la izquierda en partes UTC", () => {
    expect(toISODate(d("2026-03-05"))).toBe("2026-03-05")
    expect(toISODate(new Date(Date.UTC(2026, 0, 9)))).toBe("2026-01-09")
  })
})

describe("nextRun — semanal", () => {
  // 2026-05-13 es miércoles (getUTCDay === 3).
  it("mismo día de semana → inclusive (devuelve hoy)", () => {
    expect(iso({ frequency: "weekly", weekday: 3 }, "2026-05-13")).toBe("2026-05-13")
  })
  it("día más adelante en la misma semana", () => {
    // viernes (5) desde miércoles → +2
    expect(iso({ frequency: "weekly", weekday: 5 }, "2026-05-13")).toBe("2026-05-15")
  })
  it("día anterior en la semana → semana siguiente", () => {
    // lunes (1) desde miércoles → +5
    expect(iso({ frequency: "weekly", weekday: 1 }, "2026-05-13")).toBe("2026-05-18")
  })
  it("domingo (0) desde sábado", () => {
    // 2026-05-16 es sábado (6); domingo (0) → +1
    expect(iso({ frequency: "weekly", weekday: 0 }, "2026-05-16")).toBe("2026-05-17")
  })
  it("cruza fin de mes y de año", () => {
    // 2026-12-31 es jueves (4); viernes (5) → +1 → 2027-01-01
    expect(iso({ frequency: "weekly", weekday: 5 }, "2026-12-31")).toBe("2027-01-01")
  })
})

describe("nextRun — mensual", () => {
  it("día futuro del mes actual (inclusive)", () => {
    expect(iso({ frequency: "monthly", dayOfMonth: 20 }, "2026-05-13")).toBe("2026-05-20")
    expect(iso({ frequency: "monthly", dayOfMonth: 13 }, "2026-05-13")).toBe("2026-05-13")
  })
  it("día ya pasado este mes → mes siguiente", () => {
    expect(iso({ frequency: "monthly", dayOfMonth: 5 }, "2026-05-13")).toBe("2026-06-05")
  })
  it("día 31 en mes de 30 → último día (30)", () => {
    expect(iso({ frequency: "monthly", dayOfMonth: 31 }, "2026-04-15")).toBe("2026-04-30")
  })
  it("día 31 en febrero no bisiesto → 28", () => {
    expect(iso({ frequency: "monthly", dayOfMonth: 31 }, "2026-02-10")).toBe("2026-02-28")
  })
  it("día 31 en febrero bisiesto → 29", () => {
    expect(iso({ frequency: "monthly", dayOfMonth: 31 }, "2024-02-10")).toBe("2024-02-29")
  })
  it("día 31 cuando hoy ya es el último día más corto → ese mismo día", () => {
    // 2026-02-28: día 31 clampa a 28 y 28 >= 28 → hoy
    expect(iso({ frequency: "monthly", dayOfMonth: 31 }, "2026-02-28")).toBe("2026-02-28")
  })
  it("clamp no 'pega' el día en meses siguientes (sigue siendo 31 cuando puede)", () => {
    // desde 2026-02-15 con día 31: feb clampa a 28 pero 28<15? no, 28>=15 → 2026-02-28
    expect(iso({ frequency: "monthly", dayOfMonth: 31 }, "2026-02-15")).toBe("2026-02-28")
    // si ya pasó en feb, marzo vuelve a 31
    expect(iso({ frequency: "monthly", dayOfMonth: 31 }, "2026-03-01")).toBe("2026-03-31")
  })
  it("cruza fin de año (diciembre → enero)", () => {
    expect(iso({ frequency: "monthly", dayOfMonth: 5 }, "2026-12-20")).toBe("2027-01-05")
  })
})

describe("nextRunAfter — avanza sin contar el día actual", () => {
  it("mensual: si hoy es el día de pago, salta al mes siguiente", () => {
    const r = nextRunAfter({ frequency: "monthly", dayOfMonth: 10 }, d("2026-05-10"))
    expect(toISODate(r)).toBe("2026-06-10")
  })
  it("semanal: si hoy es el día, salta una semana", () => {
    // 2026-05-13 miércoles (3)
    const r = nextRunAfter({ frequency: "weekly", weekday: 3 }, d("2026-05-13"))
    expect(toISODate(r)).toBe("2026-05-20")
  })
})

describe("describeSchedule", () => {
  it("semanal en español", () => {
    expect(describeSchedule({ frequency: "weekly", weekday: 5 })).toBe(
      "Todos los viernes",
    )
    expect(describeSchedule({ frequency: "weekly", weekday: 0 })).toBe(
      "Todos los domingo",
    )
  })
  it("mensual día normal", () => {
    expect(describeSchedule({ frequency: "monthly", dayOfMonth: 10 })).toBe(
      "El día 10 de cada mes",
    )
  })
  it("mensual día >= 29 aclara el clamp de fin de mes", () => {
    expect(describeSchedule({ frequency: "monthly", dayOfMonth: 31 })).toBe(
      "El día 31 de cada mes (o el último, si el mes es más corto)",
    )
  })
})

describe("validación de spec inválida", () => {
  it("mensual sin dayOfMonth lanza", () => {
    expect(() => nextRun({ frequency: "monthly" }, d("2026-05-13"))).toThrow(
      /dayOfMonth/,
    )
  })
  it("mensual fuera de rango lanza", () => {
    expect(() =>
      nextRun({ frequency: "monthly", dayOfMonth: 0 }, d("2026-05-13")),
    ).toThrow(/1 y 31/)
  })
  it("semanal sin weekday lanza", () => {
    expect(() => nextRun({ frequency: "weekly" }, d("2026-05-13"))).toThrow(
      /weekday/,
    )
  })
  it("semanal fuera de rango lanza", () => {
    expect(() =>
      nextRun({ frequency: "weekly", weekday: 7 }, d("2026-05-13")),
    ).toThrow(/0 y 6/)
  })
  it("custom no soportado en MVP", () => {
    expect(() =>
      nextRun({ frequency: "custom" }, d("2026-05-13")),
    ).toThrow(/no soportada en el MVP/)
    expect(() => describeSchedule({ frequency: "custom" })).toThrow(
      /no soportada/,
    )
  })
})
