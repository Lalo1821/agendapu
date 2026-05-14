import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function OnboardingWapu() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectá tu cuenta Wapu (placeholder)</CardTitle>
          <CardDescription>
            En Fase 1.3b: form para tu API token, cifrado client-side y guardado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Por ahora salteamos este paso.</p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => navigate("/onboarding/nwc", { replace: true })} className="w-full">
            Continuar
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
