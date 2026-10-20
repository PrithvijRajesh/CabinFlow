import { useCallback, useEffect, useState } from 'react'
import type { Role, Session } from './types'
import RoleSelect from './screens/RoleSelect'
import SeatEntry from './screens/SeatEntry'
import CrewSignIn from './screens/CrewSignIn'
import { isSignedInCrew, signOutCrew } from './services/crewAuth'
import AppShell from './components/AppShell'

const STORAGE_KEY = 'cabinflow.session'

// Keep the session across page refreshes, but only for this browser tab.
function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (e.g. private mode) — session just won't survive a refresh.
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [pendingRole, setPendingRole] = useState<Role | null>(null)

  const signIn = useCallback((next: Session) => {
    saveSession(next)
    setSession(next)
    setPendingRole(null)
  }, [])
  const crewSignedIn = useCallback(() => signIn({ role: 'crew' }), [signIn])

  // A crew session saved in this tab (e.g. from the old PIN) needs a real sign-in behind it.
  useEffect(() => {
    if (session?.role !== 'crew') return
    isSignedInCrew().then((ok) => {
      if (!ok) { saveSession(null); setSession(null) }
    }).catch(() => {})
  }, [session])

  function signOut() {
    // Crew sign out ends the remembered Supabase session on this tablet too.
    if (session?.role === 'crew') void signOutCrew().catch(() => {})
    saveSession(null)
    setSession(null)
  }

  if (session) return <AppShell session={session} onSignOut={signOut} />

  if (pendingRole === 'passenger')
    return <SeatEntry onConfirm={(seat) => signIn({ role: 'passenger', seat })} onBack={() => setPendingRole(null)} />

  if (pendingRole === 'crew')
    return <CrewSignIn onConfirm={crewSignedIn} onBack={() => setPendingRole(null)} />

  return <RoleSelect onSelect={setPendingRole} />
}
