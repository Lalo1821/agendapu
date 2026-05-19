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
import { saveWapuToken } from "@/lib/wapu"

const schema = z.object({
  token: z.string().trim().min(10, "El token parece demasiado corto"),
})

type FormValues = z.infer<typeof schema>

export function OnboardingWapu() {
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

  const onSubmit = handleSubmit(async ({ token }) => {
    setSubmitError(null)
    try {
      await saveWapuToken(userId, key, token)
      navigate("/onboarding/nwc", { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo guardar el token")
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-medium text-muted-foreground">Paso 1 de 2</p>
          <CardTitle>Conectá tu cuenta Wapu</CardTitle>
          <CardDescription>
            Pegá tu API token de Wapu. Se cifra en este navegador con tu password;
            el servidor solo guarda el texto cifrado.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="token">API token de Wapu</Label>
              <Input
                id="token"
                type="password"
                autoComplete="off"
                placeholder="wapu_..."
                aria-invalid={!!errors.token}
                {...register("token")}
              />
              {errors.token && (
                <p className="text-xs text-destructive">{errors.token.message}</p>
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
              {isSubmitting ? "Guardando…" : "Continuar"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
