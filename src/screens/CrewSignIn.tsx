import { useEffect, useState, type FormEvent } from 'react'
import Icon from '../components/Icon'
import { isSignedInCrew, signInCrew } from '../services/crewAuth'

interface Props {
  onConfirm: () => void
  onBack: () => void
}

// Crew sign in once per tablet; a remembered session goes straight through.
export default function CrewSignIn({ onConfirm, onBack }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    isSignedInCrew()
      .then((yes) => { if (!cancelled && yes) onConfirm() })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [onConfirm])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signInCrew(email, password)
      onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="entry entry-crew">
      <div className="console">
        <header className="pass-head">
          <button className="back-btn" onClick={onBack}>
            <Icon name="back" size={18} /> Back
          </button>
          <span className="eyebrow">Cabin crew access</span>
        </header>

        <div className="console-body">
          <div>
            <Icon name="badge" size={36} className="console-mark" />
            <h1 className="display">Crew sign-in</h1>
            <p className="lede">Sign in once on this tablet. You stay signed in until you sign out.</p>
          </div>

          {checking ? (
            <p className="hint">Checking this tablet…</p>
          ) : (
            <form className="signin" onSubmit={submit}>
              <label className="signin-field">
                <span className="eyebrow">Crew email</span>
                <input className="lookup-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </label>
              <label className="signin-field">
                <span className="eyebrow">Password</span>
                <input className="lookup-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <button className="btn btn-primary" disabled={busy || !email || !password}>
                {busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={18} />
              </button>
              <p className={`hint ${error ? 'hint-error' : ''}`}>{error || ' '}</p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
