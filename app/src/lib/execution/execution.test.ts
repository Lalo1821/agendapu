import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMockWapuClient } from "@/lib/wapu"
import { NwcError } from "@/lib/nwc/errors"
import type { ScheduledPayment } from "@/lib/supabase/types"
import { runPayment, type PayStep } from "./index"

function makeScheduled(overrides: Partial<ScheduledPayment> = {}): ScheduledPayment {
  return {
    id: "p1",
    user_id: "u1",
    contact_alias: "alquiler.mp",
    receiver_name: "Juan",
    amount_ars: 150000,
    frequency: "monthly",
    day_of_month: 10,
    weekday: null,
    next_run: "2026-05-10",
    paused: false,
    created_at: "2026-05-01T00:00:00Z",
    ...overrides,
  }
}

function collect() {
  const steps: PayStep[] = []
  return { steps, onStep: (s: PayStep) => void steps.push(s) }
}

const stubPay = async () => ({ preimage: "deadbeef" })

afterEach(() => {
  vi.useRealTimers()
})

describe("runPayment — happy path", () => {
  it("ejecuta tentative → funding → invoice_paid → CONFIRMED", async () => {
    const wapu = createMockWapuClient({
      // default: ["PENDING", "CONFIRMED"] — basta con 1 poll antes del confirmar.
      txStatusSequence: ["PENDING", "CONFIRMED"],
    })
    const { steps, onStep } = collect()

    const result = await runPayment({
      wapu,
      pay: stubPay,
      scheduled: makeScheduled(),
      onStep,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    })

    expect(result).toEqual({
      status: "confirmed",
      txId: "mock-deposit-tx",
      preimage: "deadbeef",
    })
    expect(steps.map((s) => s.step)).toEqual([
      "quoting",
      "tentative_created",
      "funding_issued",
      "invoice_paid",
      "confirmed",
    ])
    expect(steps[1]).toMatchObject({ tentativeUuid: "mock-tentative-uuid" })
    expect(steps[2]).toMatchObject({
      bolt11: expect.stringContaining("lnbc"),
      depositTxId: "mock-deposit-tx",
    })
    expect(steps[3]).toMatchObject({ preimage: "deadbeef" })
    expect(steps[4]).toMatchObject({ txId: "mock-deposit-tx" })
  })
})

describe("runPayment — timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("devuelve timeout si nunca llega un estado terminal", async () => {
    const wapu = createMockWapuClient({
      txStatusSequence: ["PENDING", "PENDING"], // el último se repite indefinidamente
    })
    const { steps, onStep } = collect()

    const promise = runPayment({
      wapu,
      pay: stubPay,
      scheduled: makeScheduled(),
      onStep,
      pollIntervalMs: 10,
      timeoutMs: 100,
    })

    // Adelantar más allá del timeout — flush de microtasks incluido.
    await vi.advanceTimersByTimeAsync(500)
    const result = await promise

    expect(result).toEqual({ status: "timeout" })
    expect(steps.at(-1)).toEqual({ step: "timeout" })
    expect(steps.map((s) => s.step)).toContain("invoice_paid")
  })
})

describe("runPayment — error en issueFunding", () => {
  it("captura WapuError y devuelve failed", async () => {
    // El mock matchea fragmentos del pathname; /funding pertenece sólo al endpoint
    // de issueFunding (POST /transactions/direct-fiat/tentatives/<uuid>/funding).
    const wapu = createMockWapuClient({ errorOn: { funding: 500 } })
    const { steps, onStep } = collect()

    const result = await runPayment({
      wapu,
      pay: stubPay,
      scheduled: makeScheduled(),
      onStep,
      pollIntervalMs: 1,
      timeoutMs: 1_000,
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("unreachable")
    expect(result.error).toMatch(/error forzado \(500\)|HTTP 500/)
    expect(steps.map((s) => s.step)).toEqual([
      "quoting",
      "tentative_created",
      "failed",
    ])
    expect(steps.at(-1)).toMatchObject({ step: "failed", error: result.error })
  })
})

describe("runPayment — transacción CANCELED en polling", () => {
  it("devuelve failed cuando getTransaction reporta CANCELED", async () => {
    const wapu = createMockWapuClient({ txStatusSequence: ["CANCELED"] })
    const { steps, onStep } = collect()

    const result = await runPayment({
      wapu,
      pay: stubPay,
      scheduled: makeScheduled(),
      onStep,
      pollIntervalMs: 1,
      timeoutMs: 1_000,
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("unreachable")
    expect(result.error).toMatch(/cancelada/i)
    expect(steps.at(-1)).toMatchObject({ step: "failed" })
  })
})

describe("runPayment — error no clasificado en pay()", () => {
  it("re-lanza errores que no son Wapu/Nwc (no los traga silenciosamente)", async () => {
    const wapu = createMockWapuClient()
    const pay = async () => {
      throw new Error("boom inesperado")
    }
    const { steps, onStep } = collect()

    await expect(
      runPayment({
        wapu,
        pay,
        scheduled: makeScheduled(),
        onStep,
        pollIntervalMs: 1,
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow("boom inesperado")
    // No emitió "failed" — el error se propaga, no se "captura".
    expect(steps.map((s) => s.step)).not.toContain("failed")
  })
})

describe("runPayment — NwcError en pay()", () => {
  it("captura NwcError y reporta el kind en el mensaje", async () => {
    const wapu = createMockWapuClient()
    const pay = async () => {
      throw new NwcError("user_rejected", "El usuario rechazó el pago")
    }
    const { steps, onStep } = collect()

    const result = await runPayment({
      wapu,
      pay,
      scheduled: makeScheduled(),
      onStep,
      pollIntervalMs: 1,
      timeoutMs: 1_000,
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("unreachable")
    expect(result.error).toContain("user_rejected")
    // Llegó hasta funding_issued y luego falló en pay.
    expect(steps.map((s) => s.step)).toEqual([
      "quoting",
      "tentative_created",
      "funding_issued",
      "failed",
    ])
  })
})
