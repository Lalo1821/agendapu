import { beforeEach, describe, expect, it, vi } from "vitest"

// Mismo patrón de mock que payments.test.ts: builder encadenable + thenable.
const h = vi.hoisted(() => {
  const state: { result: unknown; results: unknown[] } = {
    result: { data: null, error: null },
    results: [],
  }
  const next = () => (state.results.length ? state.results.shift() : state.result)
  const from = vi.fn()
  return { state, next, from }
})

vi.mock("@/lib/supabase", () => ({ supabase: { from: h.from } }))

const { startRun, updateRun, listRuns } = await import("./index")

interface Builder {
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>
}

let builder: Builder

beforeEach(() => {
  h.state.result = { data: null, error: null }
  h.state.results = []
  const chain = () => builder
  builder = {
    insert: vi.fn(chain),
    update: vi.fn(chain),
    select: vi.fn(chain),
    eq: vi.fn(chain),
    order: vi.fn(chain),
    single: vi.fn(async () => h.next()),
    then: (res, rej) => Promise.resolve(h.next()).then(res, rej),
  }
  h.from.mockReturnValue(builder)
})

describe("startRun", () => {
  it("inserta con status 'pending' y devuelve la fila", async () => {
    h.state.result = {
      data: { id: "r1", status: "pending", ars_amount: 150000 },
      error: null,
    }
    const row = await startRun("u1", "p1", 150000)
    expect(h.from).toHaveBeenCalledWith("payment_runs")
    expect(builder.insert.mock.calls[0][0]).toEqual({
      user_id: "u1",
      scheduled_payment_id: "p1",
      ars_amount: 150000,
      status: "pending",
    })
    expect(row).toEqual({ id: "r1", status: "pending", ars_amount: 150000 })
  })

  it("propaga error de supabase", async () => {
    h.state.result = { data: null, error: new Error("insert fail") }
    await expect(startRun("u1", "p1", 1)).rejects.toThrow("insert fail")
  })
})

describe("updateRun", () => {
  it("actualiza el status y devuelve la fila", async () => {
    h.state.result = {
      data: { id: "r1", status: "confirmed" },
      error: null,
    }
    const row = await updateRun("u1", "r1", { status: "confirmed" })
    expect(builder.update.mock.calls[0][0]).toEqual({ status: "confirmed" })
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1")
    expect(builder.eq).toHaveBeenCalledWith("id", "r1")
    expect(row).toEqual({ id: "r1", status: "confirmed" })
  })

  it("tira error si supabase devuelve error", async () => {
    h.state.result = { data: null, error: new Error("upd fail") }
    await expect(
      updateRun("u1", "r1", { status: "failed" }),
    ).rejects.toThrow("upd fail")
  })
})

describe("listRuns", () => {
  it("devuelve la lista ordenada por started_at DESC", async () => {
    h.state.result = {
      data: [{ id: "r2" }, { id: "r1" }],
      error: null,
    }
    const rows = await listRuns("u1")
    expect(h.from).toHaveBeenCalledWith("payment_runs")
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1")
    expect(builder.eq).not.toHaveBeenCalledWith(
      "scheduled_payment_id",
      expect.anything(),
    )
    expect(builder.order).toHaveBeenCalledWith("started_at", { ascending: false })
    expect(rows).toEqual([{ id: "r2" }, { id: "r1" }])
  })

  it("[] cuando data es null", async () => {
    h.state.result = { data: null, error: null }
    expect(await listRuns("u1")).toEqual([])
  })

  it("filtra por scheduledPaymentId cuando se pasa", async () => {
    h.state.result = { data: [{ id: "r1" }], error: null }
    await listRuns("u1", "p1")
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1")
    expect(builder.eq).toHaveBeenCalledWith("scheduled_payment_id", "p1")
  })

  it("lanza ante error", async () => {
    h.state.result = { data: null, error: new Error("list fail") }
    await expect(listRuns("u1")).rejects.toThrow("list fail")
  })
})
