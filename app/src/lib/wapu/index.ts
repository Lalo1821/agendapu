// Persistencia cifrada del token Wapu (Fase 1).
export { saveWapuToken, getWapuToken, hasWapuToken } from "./credentials"
// Cliente HTTP tipado + errores + mock (Fase 2).
export { createWapuClient } from "./client"
export type { WapuClient, WapuClientOptions } from "./client"
export { WapuError, KIND_EXIT_CODE } from "./errors"
export type { WapuErrorKind } from "./errors"
export { createWapuMockFetch, createMockWapuClient, MOCK_WAPU } from "./mock"
export type { WapuMockState } from "./mock"
export type * from "./types"
