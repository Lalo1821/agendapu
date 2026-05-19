import { beforeEach, describe, expect, it, vi } from "vitest"

// Mismo patrón que connections.test.ts: builder encadenable + thenable.
// `results` es una cola para flujos con varias queries (resume = get + update);
// si está vacía cae a `result`.
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

const {
  paymentInputSchema,
  createScheduledPayment,
  listScheduledPayments,
  getScheduledPayment,
  updateScheduledPayment,
  setPaused,
  deleteScheduledPayment,
} = await import("./index")

interface Builder {
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
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
    delete: vi.fn(chain),
    select: vi.fn(chain),
    eq: vi.fn(chain),
    order: vi.fn(chain),
    single: vi.fn(async () => h.next()),
    maybeSingle: vi.fn(async () => h.next()),
    then: (res, rej) => Promise.resolve(h.next()).then(res, rej),
  }
  h.from.mockReturnValue(builder)
})

// Miércoles 2026-05-13 (getUTCDay === 3) — base determinista para next_run.
const FROM = new Date("2026-05-13T00:00:00.000Z")

describe("paymentInputSchema", () => {
  const base = {
    contactAlias: "alquiler.mp",
    amountArs: 150000,
  }

  it("acepta mensual con día del mes", () => {
    const r = paymentInputSchema.safeParse({
      ...base,
      frequency: "monthly",
      dayOfMonth: 10,
    })
    expect(r.success).toBe(true)
  })

  it("rechaza mensual sin día del mes", () => {
    const r = paymentInputSchema.safeParse({ ...base, frequency: "monthly" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["dayOfMonth"])
    }
  })

  it("rechaza semanal sin día de semana", () => {
    const r = paymentInputSchema.safeParse({ ...base, frequency: "weekly" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["weekday"])
    }
  })

  it("rechaza monto <= 0 y alias vacío", () => {
    expect(
      paymentInputSchema.safeParse({
        contactAlias: "",
        amountArs: 0,
        frequency: "weekly",
        weekday: 1,
      }).success,
    ).toBe(false)
  })
})

describe("createScheduledPayment", () => {
  it("mapea campos, calcula next_run y deja weekday null en mensual", async () => {
    h.state.result = { data: { id: "p1" }, error: null }
    const row = await createScheduledPayment(
      "u1",
      {
        contactAlias: "  alquiler.mp  ",
        receiverName: "  Juan  ",
        amountArs: 150000,
        frequency: "monthly",
        dayOfMonth: 20,
      },
      FROM,
    )
    expect(h.from).toHaveBeenCalledWith("scheduled_payments")
    expect(builder.insert.mock.calls[0][0]).toMatchObject({
      user_id: "u1",
      contact_alias: "alquiler.mp",
      receiver_name: "Juan",
      amount_ars: 150000,
      frequency: "monthly",
      day_of_month: 20,
      weekday: null,
      next_run: "2026-05-20",
    })
    expect(row).toEqual({ id: "p1" })
  })

  it("semanal: day_of_month null y next_run al próximo weekday", async () => {
    h.state.result = { data: { id: "p2" }, error: null }
    await createScheduledPayment(
      "u1",
      {
        contactAlias: "club",
        receiverName: "",
        amountArs: 5000,
        frequency: "weekly",
        weekday: 5, // viernes; desde miércoles 13 → 15
      },
      FROM,
    )
    expect(builder.insert.mock.calls[0][0]).toMatchObject({
      receiver_name: null,
      day_of_month: null,
      weekday: 5,
      next_run: "2026-05-15",
    })
  })

  it("propaga error de supabase", async () => {
    h.state.result = { data: null, error: new Error("insert fail") }
    await expect(
      createScheduledPayment(
        "u1",
        { contactAlias: "x", amountArs: 1, frequency: "weekly", weekday: 1 },
        FROM,
      ),
    ).rejects.toThrow("insert fail")
  })
})

describe("listScheduledPayments", () => {
  it("devuelve la lista ordenada", async () => {
    h.state.result = { data: [{ id: "a" }, { id: "b" }], error: null }
    expect(await listScheduledPayments("u1")).toEqual([{ id: "a" }, { id: "b" }])
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1")
    expect(builder.order).toHaveBeenCalledWith("paused", { ascending: true })
  })

  it("[] cuando data es null", async () => {
    h.state.result = { data: null, error: null }
    expect(await listScheduledPayments("u1")).toEqual([])
  })

  it("lanza ante error", async () => {
    h.state.result = { data: null, error: new Error("e") }
    await expect(listScheduledPayments("u1")).rejects.toThrow("e")
  })
})

describe("getScheduledPayment", () => {
  it("devuelve la fila", async () => {
    h.state.result = { data: { id: "p1" }, error: null }
    expect(await getScheduledPayment("u1", "p1")).toEqual({ id: "p1" })
  })
  it("null si no existe", async () => {
    h.state.result = { data: null, error: null }
    expect(await getScheduledPayment("u1", "p1")).toBeNull()
  })
  it("lanza ante error", async () => {
    h.state.result = { data: null, error: new Error("x") }
    await expect(getScheduledPayment("u1", "p1")).rejects.toThrow("x")
  })
})

describe("updateScheduledPayment", () => {
  it("recalcula next_run con los nuevos datos", async () => {
    h.state.result = { data: { id: "p1" }, error: null }
    await updateScheduledPayment(
      "u1",
      "p1",
      {
        contactAlias: "nuevo",
        amountArs: 999,
        frequency: "monthly",
        dayOfMonth: 5, // ya pasó el 13 → mes que viene
      },
      FROM,
    )
    expect(builder.update.mock.calls[0][0]).toMatchObject({
      contact_alias: "nuevo",
      day_of_month: 5,
      next_run: "2026-06-05",
    })
    expect(builder.eq).toHaveBeenCalledWith("id", "p1")
  })

  it("propaga error", async () => {
    h.state.result = { data: null, error: new Error("upd fail") }
    await expect(
      updateScheduledPayment(
        "u1",
        "p1",
        { contactAlias: "x", amountArs: 1, frequency: "weekly", weekday: 0 },
        FROM,
      ),
    ).rejects.toThrow("upd fail")
  })
})

describe("setPaused", () => {
  it("pausar: setea paused=true sin tocar next_run", async () => {
    h.state.result = { data: { id: "p1", paused: true }, error: null }
    await setPaused("u1", "p1", true, FROM)
    expect(builder.update.mock.calls[0][0]).toEqual({ paused: true })
  })

  it("reanudar: lee la fila y recalcula next_run desde hoy", async () => {
    // 1ª query (getScheduledPayment) → fila actual; 2ª (update) → resultado.
    h.state.results = [
      {
        data: {
          id: "p1",
          frequency: "monthly",
          day_of_month: 5,
          weekday: null,
        },
        error: null,
      },
      { data: { id: "p1", paused: false }, error: null },
    ]
    await setPaused("u1", "p1", false, FROM)
    expect(builder.update.mock.calls[0][0]).toEqual({
      paused: false,
      next_run: "2026-06-05",
    })
  })

  it("reanudar lanza si la fila no existe", async () => {
    h.state.results = [{ data: null, error: null }]
    await expect(setPaused("u1", "p1", false, FROM)).rejects.toThrow(
      "El pago no existe",
    )
  })
})

describe("deleteScheduledPayment", () => {
  it("borra filtrando por user e id", async () => {
    h.state.result = { error: null }
    await deleteScheduledPayment("u1", "p1")
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1")
    expect(builder.eq).toHaveBeenCalledWith("id", "p1")
  })

  it("lanza ante error", async () => {
    h.state.result = { error: new Error("del fail") }
    await expect(deleteScheduledPayment("u1", "p1")).rejects.toThrow("del fail")
  })
})
