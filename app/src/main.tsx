import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import { App } from "./App"
import { KeyProvider } from "@/lib/crypto/KeyContext"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KeyProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </KeyProvider>
  </StrictMode>,
)
