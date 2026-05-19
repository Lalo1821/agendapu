// Errores tipados del cliente NWC. La UI decide el mensaje según `kind`.
export type NwcErrorKind =
  | "wallet_offline" // no se pudo hablar con la wallet (relay caído, URL inválida, rate limit)
  | "insufficient_balance" // saldo o presupuesto de la conexión insuficiente
  | "user_rejected" // la wallet/permiso rechazó el pago
  | "timeout" // la wallet no respondió dentro del límite
  | "unknown" // error no clasificado

export class NwcError extends Error {
  readonly kind: NwcErrorKind
  readonly cause?: unknown

  constructor(kind: NwcErrorKind, message: string, cause?: unknown) {
    super(message)
    this.name = "NwcError"
    this.kind = kind
    this.cause = cause
  }
}
