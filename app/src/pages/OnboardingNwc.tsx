import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function OnboardingNwc() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectá tu wallet Lightning vía NWC (placeholder)</CardTitle>
          <CardDescription>
            En Fase 1.3b: form para tu connection string NWC, cifrado client-side y guardado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Por ahora salteamos este paso.</p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => navigate("/dashboard", { replace: true })} className="w-full">
            Ir al dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
