// Errores tipados del cliente Wapu. `exitCode` espeja el del CLI oficial
// (wapu-cli): 1 red/genérico, 2 validación, 3 auth, 4 rate limit.
export type WapuErrorKind = "validation" | "auth" | "rate_limit" | "network"

const STATUS_KIND: Record<number, WapuErrorKind> = {
  400: "validation",
  404: "validation",
  401: "auth",
  403: "auth",
  429: "rate_limit",
}

export const KIND_EXIT_CODE: Record<WapuErrorKind, number> = {
  network: 1,
  validation: 2,
  auth: 3,
  rate_limit: 4,
}

function extractMessage(body: unknown): string | null {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>
    for (const k of ["detail", "message", "error"]) {
      if (typeof b[k] === "string") return b[k] as string
    }
  }
  if (typeof body === "string" && body.trim()) return body
  return null
}

export class WapuError extends Error {
  readonly kind: WapuErrorKind
  readonly status: number | null
  readonly exitCode: number
  readonly body: unknown

  constructor(
    kind: WapuErrorKind,
    message: string,
    opts: { status?: number | null; body?: unknown } = {},
  ) {
    super(message)
    this.name = "WapuError"
    this.kind = kind
    this.status = opts.status ?? null
    this.exitCode = KIND_EXIT_CODE[kind]
    this.body = opts.body
  }

  // Otros 4xx/5xx caen en "network" (exitCode 1), igual que el CLI.
  static fromHttp(status: number, body: unknown): WapuError {
    const kind = STATUS_KIND[status] ?? "network"
    const message = extractMessage(body) ?? `Wapu respondió con HTTP ${status}`
    return new WapuError(kind, message, { status, body })
  }
}
