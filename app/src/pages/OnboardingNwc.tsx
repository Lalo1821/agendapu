import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Navigate, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useKey } from "@/lib/crypto/KeyContext"
import { useSession } from "@/lib/auth/useSession"
import { saveNwcConnection } from "@/lib/nwc"

const schema = z.object({
  connectionString: z
    .string()
    .trim()
    .startsWith("nostr+walletconnect://", "Debe empezar con nostr+walletconnect://"),
})

type FormValues = z.infer<typeof schema>

export function OnboardingNwc() {
  const navigate = useNavigate()
  const { key } = useKey()
  const sessionState = useSession()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Clave perdida (refresh): hay que volver a autenticarse para re-derivarla.
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

  const userId = sessionState.session.user.id

  const onSubmit = handleSubmit(async ({ connectionString }) => {
    setSubmitError(null)
    try {
      await saveNwcConnection(userId, key, connectionString)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "No se pudo guardar la conexión",
      )
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-medium text-muted-foreground">Paso 2 de 2</p>
          <CardTitle>Conectá tu wallet Lightning</CardTitle>
          <CardDescription>
            Pegá tu connection string de Nostr Wallet Connect (NWC). Se cifra en
            este navegador con tu password; nunca se envía en claro.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="connectionString">Connection string NWC</Label>
              <Input
                id="connectionString"
                type="password"
                autoComplete="off"
                placeholder="nostr+walletconnect://..."
                aria-invalid={!!errors.connectionString}
                {...register("connectionString")}
              />
              {errors.connectionString && (
                <p className="text-xs text-destructive">
                  {errors.connectionString.message}
                </p>
              )}
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Guardando…" : "Ir al dashboard"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
