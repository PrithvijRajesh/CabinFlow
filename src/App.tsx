import { useState } from 'react'
import type { Role, Session } from './types'
import RoleSelect from './screens/RoleSelect'
import SeatEntry from './screens/SeatEntry'
import CrewPin from './screens/CrewPin'
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

  function signIn(next: Session) {
    saveSession(next)
    setSession(next)
    setPendingRole(null)
  }

  function signOut() {
    saveSession(null)
    setSession(null)
  }

  if (session) return <AppShell session={session} onSignOut={signOut} />

  if (pendingRole === 'passenger')
    return <SeatEntry onConfirm={(seat) => signIn({ role: 'passenger', seat })} onBack={() => setPendingRole(null)} />

  if (pendingRole === 'crew')
    return <CrewPin onConfirm={() => signIn({ role: 'crew' })} onBack={() => setPendingRole(null)} />

  return <RoleSelect onSelect={setPendingRole} />
}
