import { Navigate, Route, Routes } from "react-router-dom"
import { Login } from "@/pages/Login"
import { Signup } from "@/pages/Signup"
import { Dashboard } from "@/pages/Dashboard"
import { OnboardingWapu } from "@/pages/OnboardingWapu"
import { OnboardingNwc } from "@/pages/OnboardingNwc"
import { ProtectedRoute } from "@/components/ProtectedRoute"

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding/wapu" element={<OnboardingWapu />} />
        <Route path="/onboarding/nwc" element={<OnboardingNwc />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
