import { test, expect } from "@playwright/test"

const email = process.env.PLAYWRIGHT_TEST_EMAIL
const password = process.env.PLAYWRIGHT_TEST_PASSWORD
const paymentId = process.env.PLAYWRIGHT_TEST_PAYMENT_ID

// Skip a nivel de archivo: si faltan env vars no se lanza el browser.
test.skip(
  !email || !password || !paymentId,
  "Faltan PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD / PLAYWRIGHT_TEST_PAYMENT_ID",
)

test("ejecuta un pago en modo mock end-to-end", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email!)
  await page.getByLabel("Password").fill(password!)
  await page.getByRole("button", { name: "Entrar" }).click()

  // AuthForm redirige a /onboarding/wapu; basta con salir de /login antes
  // de navegar al detalle del pago (la sesión queda autenticada igual).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  })

  await page.goto(`/payments/${paymentId}?mock=1`)

  await page.getByRole("button", { name: "Pagar ahora" }).click()

  await expect(page.getByRole("button", { name: "Confirmar pago" })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/sats/i)).toBeVisible()

  await page.getByRole("button", { name: "Confirmar pago" }).click()

  await expect(page.getByText(/Pago confirmado/i)).toBeVisible({
    timeout: 30_000,
  })
})
