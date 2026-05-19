// Persistencia cifrada de la conexión NWC (Fase 1).
export { saveNwcConnection, getNwcConnection, hasNwcConnection } from "./connections"
// Cliente NWC sobre @getalby/sdk (Fase 2).
export { payInvoice, getNwcInfo, getNwcBalance } from "./client"
export type { PayInvoiceResult, NwcInfo, NwcBalance } from "./client"
export { NwcError } from "./errors"
export type { NwcErrorKind } from "./errors"
