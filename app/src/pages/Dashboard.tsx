import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { signOut } from "@/lib/auth"
import { useSession } from "@/lib/auth/useSession"

export function Dashboard() {
  const navigate = useNavigate()
  const state = useSession()

  const handleSignOut = async () => {
    await signOut()
    navigate("/login", { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">AgendaPu</h1>
        <Button variant="outline" onClick={handleSignOut}>Salir</Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard (placeholder)</CardTitle>
          <CardDescription>
            Acá vas a ver tus pagos agendados y el botón "Pagar ahora" cuando llegue Fase 4.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sesión activa: {state.status === "authenticated" ? state.session.user.email : "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
