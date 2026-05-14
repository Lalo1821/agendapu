import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export type SessionState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "authenticated"; session: Session }

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" })

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setState(data.session ? { status: "authenticated", session: data.session } : { status: "anon" })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setState(session ? { status: "authenticated", session } : { status: "anon" })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}
