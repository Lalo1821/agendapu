import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "react-router-dom"
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
import { signIn, signUp } from "@/lib/auth"

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
})

type FormValues = z.infer<typeof schema>

interface AuthFormProps {
  mode: "signup" | "login"
}

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null)
    setNeedsConfirmation(false)
    try {
      const result =
        mode === "signup" ? await signUp(email, password) : await signIn(email, password)

      if (!result.session) {
        setNeedsConfirmation(true)
        return
      }
      navigate("/onboarding/wapu", { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error desconocido")
    }
  })

  const isSignup = mode === "signup"

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignup ? "Crear cuenta en AgendaPu" : "Entrar a AgendaPu"}</CardTitle>
          <CardDescription>
            {isSignup
              ? "Tu password se usa para cifrar tus credenciales en este navegador. No se envía al servidor."
              : "Ingresá con tu email y password."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {needsConfirmation && (
              <Alert>
                <AlertDescription>
                  Cuenta creada. Revisá tu email para confirmar antes de seguir.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Procesando…" : isSignup ? "Crear cuenta" : "Entrar"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {isSignup ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
              <Link
                to={isSignup ? "/login" : "/signup"}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {isSignup ? "Entrar" : "Crear cuenta"}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
