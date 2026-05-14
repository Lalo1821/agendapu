import { Navigate, Outlet } from "react-router-dom"
import { useSession } from "@/lib/auth/useSession"

export function ProtectedRoute() {
  const state = useSession()

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    )
  }

  if (state.status === "anon") {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
