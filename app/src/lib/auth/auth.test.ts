import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: mocks },
}))

import { getCurrentSession, signIn, signOut, signUp } from "./index"

describe("auth lib", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset())
  })

  it("signUp llama a supabase con el formato correcto y devuelve user+session", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "t1" } },
      error: null,
    })
    const r = await signUp("a@b.com", "secret123")
    expect(mocks.signUp).toHaveBeenCalledWith({ email: "a@b.com", password: "secret123" })
    expect(r.user?.id).toBe("u1")
    expect(r.session?.access_token).toBe("t1")
  })

  it("signUp lanza si supabase devuelve error", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("email already exists"),
    })
    await expect(signUp("a@b.com", "secret123")).rejects.toThrow("email already exists")
  })

  it("signUp con email confirmation activado devuelve session=null sin lanzar", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    })
    const r = await signUp("a@b.com", "secret123")
    expect(r.user?.id).toBe("u1")
    expect(r.session).toBeNull()
  })

  it("signIn usa signInWithPassword", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "t1" } },
      error: null,
    })
    const r = await signIn("a@b.com", "secret")
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "secret" })
    expect(r.session?.access_token).toBe("t1")
  })

  it("signIn lanza si las credenciales son inválidas", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("invalid credentials"),
    })
    await expect(signIn("a@b.com", "wrong")).rejects.toThrow("invalid credentials")
  })

  it("signOut llama a supabase.auth.signOut", async () => {
    mocks.signOut.mockResolvedValue({ error: null })
    await signOut()
    expect(mocks.signOut).toHaveBeenCalled()
  })

  it("getCurrentSession devuelve la sesión actual", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "t1" } } })
    const s = await getCurrentSession()
    expect(s?.access_token).toBe("t1")
  })

  it("getCurrentSession devuelve null si no hay sesión", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    expect(await getCurrentSession()).toBeNull()
  })
})
