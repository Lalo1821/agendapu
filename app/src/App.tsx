import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"

// Code-splitting por ruta: el bundle inicial (login/signup) no arrastra
// dashboard, forms ni el SDK NWC. Mantiene el build sin warning de chunk.
const Login = lazy(() => import("@/pages/Login").then((m) => ({ default: m.Login })))
const Signup = lazy(() =>
  import("@/pages/Signup").then((m) => ({ default: m.Signup })),
)
const Dashboard = lazy(() =>
  import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })),
)
const PaymentForm = lazy(() =>
  import("@/pages/PaymentForm").then((m) => ({ default: m.PaymentForm })),
)
const PaymentDetail = lazy(() =>
  import("@/pages/PaymentDetail").then((m) => ({ default: m.PaymentDetail })),
)
const OnboardingWapu = lazy(() =>
  import("@/pages/OnboardingWapu").then((m) => ({ default: m.OnboardingWapu })),
)
const OnboardingNwc = lazy(() =>
  import("@/pages/OnboardingNwc").then((m) => ({ default: m.OnboardingNwc })),
)
const Health = lazy(() =>
  import("@/pages/Health").then((m) => ({ default: m.Health })),
)

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Cargando…
    </div>
  )
}

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding/wapu" element={<OnboardingWapu />} />
          <Route path="/onboarding/nwc" element={<OnboardingNwc />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/payments/new" element={<PaymentForm />} />
          <Route path="/payments/:id" element={<PaymentDetail />} />
          <Route path="/payments/:id/edit" element={<PaymentForm />} />
          <Route path="/health" element={<Health />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
