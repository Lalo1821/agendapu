import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => {
  class Nip47Error extends Error {
    code: string
    constructor(message: string, code = "OTHER") {
      super(message)
      this.code = code
    }
  }
  class Nip47NetworkError extends Nip47Error {}
  class Nip47TimeoutError extends Nip47Error {}
  class Nip47WalletError extends Nip47Error {}

  const behavior: {
    payInvoice: () => Promise<{ preimage: string; fees_paid?: number }>
    getInfo: () => Promise<unknown>
    getBalance: () => Promise<{ balance: number }>
    ctorThrows: boolean
  } = {
    payInvoice: async () => ({ preimage: "preimg", fees_paid: 100 }),
    getInfo: async () => ({
      alias: "MiWallet",
      network: "mainnet",
      methods: ["pay_invoice", "get_balance"],
      lud16: "lalo@getalby.com",
    }),
    getBalance: async () => ({ balance: 21_000_000 }),
    ctorThrows: false,
  }
  const closed = { count: 0 }

  return {
    Nip47Error,
    Nip47NetworkError,
    Nip47TimeoutError,
    Nip47WalletError,
    behavior,
    closed,
  }
})

vi.mock("@getalby/sdk", () => {
  class NWCClient {
    constructor() {
      if (h.behavior.ctorThrows) throw new Error("invalid NWC url")
    }
    payInvoice() {
      return h.behavior.payInvoice()
    }
    getInfo() {
      return h.behavior.getInfo()
    }
    getBalance() {
      return h.behavior.getBalance()
    }
    close() {
      h.closed.count += 1
    }
  }
  return {
    NWCClient,
    Nip47Error: h.Nip47Error,
    Nip47NetworkError: h.Nip47NetworkError,
    Nip47TimeoutError: h.Nip47TimeoutError,
    Nip47WalletError: h.Nip47WalletError,
  }
})

const { payInvoice, getNwcInfo, getNwcBalance } = await import("./client")
const { NwcError } = await import("./errors")

const NWC = "nostr+walletconnect://abc?relay=wss://r&secret=s"

beforeEach(() => {
  h.behavior.payInvoice = async () => ({ preimage: "preimg", fees_paid: 100 })
  h.behavior.getInfo = async () => ({
    alias: "MiWallet",
    network: "mainnet",
    methods: ["pay_invoice"],
    lud16: "lalo@getalby.com",
  })
  h.behavior.getBalance = async () => ({ balance: 21_000_000 })
  h.behavior.ctorThrows = false
  h.closed.count = 0
})

describe("payInvoice", () => {
  it("devuelve preimage + fees y cierra la conexión", async () => {
    const res = await payInvoice(NWC, "lnbc1")
    expect(res).toEqual({ preimage: "preimg", feesPaidMsat: 100 })
    expect(h.closed.count).toBe(1)
  })

  it("fees_paid ausente → feesPaidMsat 0", async () => {
    h.behavior.payInvoice = async () => ({ preimage: "p" })
    expect((await payInvoice(NWC, "lnbc1")).feesPaidMsat).toBe(0)
  })

  it("INSUFFICIENT_BALANCE → kind insufficient_balance", async () => {
    h.behavior.payInvoice = async () => {
      throw new h.Nip47WalletError("sin fondos", "INSUFFICIENT_BALANCE")
    }
    const err = await payInvoice(NWC, "lnbc1").catch((e) => e)
    expect(err).toBeInstanceOf(NwcError)
    expect(err.kind).toBe("insufficient_balance")
    expect(h.closed.count).toBe(1)
  })

  it("RESTRICTED → kind user_rejected", async () => {
    h.behavior.payInvoice = async () => {
      throw new h.Nip47WalletError("denegado", "RESTRICTED")
    }
    const err = await payInvoice(NWC, "lnbc1").catch((e) => e)
    expect(err.kind).toBe("user_rejected")
  })

  it("Nip47NetworkError → kind wallet_offline", async () => {
    h.behavior.payInvoice = async () => {
      throw new h.Nip47NetworkError("relay caído")
    }
    const err = await payInvoice(NWC, "lnbc1").catch((e) => e)
    expect(err.kind).toBe("wallet_offline")
  })

  it("Nip47TimeoutError del sdk → kind timeout", async () => {
    h.behavior.payInvoice = async () => {
      throw new h.Nip47TimeoutError("sin respuesta")
    }
    const err = await payInvoice(NWC, "lnbc1").catch((e) => e)
    expect(err.kind).toBe("timeout")
  })

  it("código de wallet desconocido → kind unknown", async () => {
    h.behavior.payInvoice = async () => {
      throw new h.Nip47WalletError("raro", "WEIRD_CODE")
    }
    const err = await payInvoice(NWC, "lnbc1").catch((e) => e)
    expect(err.kind).toBe("unknown")
  })

  it("Nip47TimeoutError del SDK se mapea a NwcError timeout", async () => {
    h.behavior.payInvoice = async () => {
      throw new h.Nip47TimeoutError("reply timeout", "INTERNAL")
    }
    const err = await payInvoice(NWC, "lnbc1").catch((e) => e)
    expect(err).toBeInstanceOf(NwcError)
    expect(err.kind).toBe("timeout")
    expect(h.closed.count).toBe(1)
  })

  it("connection string inválida → kind wallet_offline", async () => {
    h.behavior.ctorThrows = true
    const err = await payInvoice("basura", "lnbc1").catch((e) => e)
    expect(err).toBeInstanceOf(NwcError)
    expect(err.kind).toBe("wallet_offline")
  })
})

describe("getNwcInfo / getNwcBalance", () => {
  it("getNwcInfo mapea los campos", async () => {
    const info = await getNwcInfo(NWC)
    expect(info).toEqual({
      alias: "MiWallet",
      network: "mainnet",
      methods: ["pay_invoice"],
      lud16: "lalo@getalby.com",
    })
  })

  it("getNwcInfo con lud16 ausente → null", async () => {
    h.behavior.getInfo = async () => ({
      alias: "W",
      network: "mainnet",
      methods: [],
    })
    expect((await getNwcInfo(NWC)).lud16).toBeNull()
  })

  it("getNwcBalance convierte msat → sats", async () => {
    const bal = await getNwcBalance(NWC)
    expect(bal).toEqual({ balanceMsat: 21_000_000, balanceSats: 21_000 })
  })
})
