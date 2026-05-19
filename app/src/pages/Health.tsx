import { useEffect, useState, type ReactNode } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useKey } from "@/lib/crypto/KeyContext"
import { useSession } from "@/lib/auth/useSession"
import { createMockWapuClient, createWapuClient, getWapuToken, WapuError } from "@/lib/wapu"
import { getNwcBalance, getNwcConnection, getNwcInfo, NwcError } from "@/lib/nwc"

type Check<T> =
  | { status: "loading" }
  | { status: "skipped"; reason: string }
  | { status: "ok"; data: T }
  | { status: "error"; kind: string; message: string }

interface WapuOk {
  username: string
  lightningAddress: string | null
}

interface NwcOk {
  alias: string
  network: string
  balanceSats: number | null
}

function StatusLine({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

export function Health() {
  const { key } = useKey()
  const sessionState = useSession()
  const [searchParams] = useSearchParams()
  const useMock = searchParams.get("mock") === "1"

  const [wapu, setWapu] = useState<Check<WapuOk>>({ status: "loading" })
  const [nwc, setNwc] = useState<Check<NwcOk>>({ status: "loading" })

  const userId =
    sessionState.status === "authenticated" ? sessionState.session.user.id : null

  useEffect(() => {
    if (!key || !userId) return
    let active = true

    async function checkWapu() {
      try {
        if (useMock) {
          const home = await createMockWapuClient().getHome()
          if (active)
            setWapu({
              status: "ok",
              data: {
                username: home.username,
                lightningAddress: home.lightning_address ?? null,
              },
            })
          return
        }
        const token = await getWapuToken(userId!, key!)
        if (!token) {
          if (active)
            setWapu({ status: "skipped", reason: "No hay token Wapu configurado" })
          return
        }
        const home = await createWapuClient({ apiKey: token }).getHome()
        if (active)
          setWapu({
            status: "ok",
            data: {
              username: home.username,
              lightningAddress: home.lightning_address ?? null,
            },
          })
      } catch (err) {
        if (!active) return
        if (err instanceof WapuError) {
          setWapu({ status: "error", kind: err.kind, message: err.message })
        } else {
          setWapu({
            status: "error",
            kind: "desconocido",
            message: err instanceof Error ? err.message : "Error inesperado",
          })
        }
      }
    }

    async function checkNwc() {
      try {
        const conn = await getNwcConnection(userId!, key!)
        if (!conn) {
          if (active)
            setNwc({ status: "skipped", reason: "No hay conexión NWC configurada" })
          return
        }
        const info = await getNwcInfo(conn)
        // El saldo es opcional: algunas wallets no exponen get_balance.
        let balanceSats: number | null = null
        try {
          balanceSats = (await getNwcBalance(conn)).balanceSats
        } catch {
          balanceSats = null
        }
        if (active)
          setNwc({
            status: "ok",
            data: { alias: info.alias, network: info.network, balanceSats },
          })
      } catch (err) {
        if (!active) return
        if (err instanceof NwcError) {
          setNwc({ status: "error", kind: err.kind, message: err.message })
        } else {
          setNwc({
            status: "error",
            kind: "desconocido",
            message: err instanceof Error ? err.message : "Error inesperado",
          })
        }
      }
    }

    void checkWapu()
    void checkNwc()
    return () => {
      active = false
    }
  }, [key, userId, useMock])

  // Clave perdida (refresh): re-autenticarse para re-derivarla.
  if (!key) return <Navigate to="/login" replace />
  if (sessionState.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    )
  }
  if (sessionState.status !== "authenticated") {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Estado de conexiones</h1>
        <Button variant="outline" asChild>
          <Link to="/dashboard">Volver</Link>
        </Button>
      </header>

      {useMock && (
        <Alert>
          <AlertTitle>Modo demo</AlertTitle>
          <AlertDescription>
            Wapu está mockeado (<code>?mock=1</code>). Quitá el parámetro para probar
            contra la API real.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Wapu</CardTitle>
          <CardDescription>
            Ping a <code>/users/home</code>: token válido y lightning address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wapu.status === "loading" && <StatusLine>Comprobando…</StatusLine>}
          {wapu.status === "skipped" && <StatusLine>⏭️ {wapu.reason}</StatusLine>}
          {wapu.status === "ok" && (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-emerald-600">✅ Conectado</p>
              <p className="text-muted-foreground">Usuario: {wapu.data.username}</p>
              <p className="text-muted-foreground">
                Lightning address: {wapu.data.lightningAddress ?? "—"}
              </p>
            </div>
          )}
          {wapu.status === "error" && (
            <Alert variant="destructive">
              <AlertTitle>Falló ({wapu.kind})</AlertTitle>
              <AlertDescription>{wapu.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NWC (wallet Lightning)</CardTitle>
          <CardDescription>
            Conexión a tu wallet vía Nostr Wallet Connect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nwc.status === "loading" && <StatusLine>Comprobando…</StatusLine>}
          {nwc.status === "skipped" && <StatusLine>⏭️ {nwc.reason}</StatusLine>}
          {nwc.status === "ok" && (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-emerald-600">✅ Wallet en línea</p>
              <p className="text-muted-foreground">Alias: {nwc.data.alias || "—"}</p>
              <p className="text-muted-foreground">Red: {nwc.data.network}</p>
              <p className="text-muted-foreground">
                Saldo:{" "}
                {nwc.data.balanceSats == null
                  ? "no disponible"
                  : `${nwc.data.balanceSats.toLocaleString("es-AR")} sats`}
              </p>
            </div>
          )}
          {nwc.status === "error" && (
            <Alert variant="destructive">
              <AlertTitle>Falló ({nwc.kind})</AlertTitle>
              <AlertDescription>{nwc.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
