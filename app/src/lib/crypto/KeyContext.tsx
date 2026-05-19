import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { deriveKey } from "./derive"
import { ensureProfile } from "./profile"

interface KeyContextValue {
  // Clave AES-GCM derivada del password. Vive solo en memoria, nunca se persiste.
  key: CryptoKey | null
  unlock: (userId: string, password: string) => Promise<void>
  lock: () => void
}

const KeyContext = createContext<KeyContextValue | null>(null)

export function KeyProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null)

  const unlock = useCallback(async (userId: string, password: string) => {
    const salt = await ensureProfile(userId)
    setKey(await deriveKey(password, salt))
  }, [])

  const lock = useCallback(() => setKey(null), [])

  const value = useMemo<KeyContextValue>(
    () => ({ key, unlock, lock }),
    [key, unlock, lock],
  )

  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>
}

export function useKey(): KeyContextValue {
  const ctx = useContext(KeyContext)
  if (!ctx) throw new Error("useKey debe usarse dentro de <KeyProvider>")
  return ctx
}
