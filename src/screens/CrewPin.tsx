import { useCallback, useEffect, useState } from 'react'
import { CREW_PIN } from '../data/flight'
import Icon from '../components/Icon'
import Keypad from '../components/Keypad'

interface Props {
  onConfirm: () => void
  onBack: () => void
}

export default function CrewPin({ onConfirm, onBack }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const press = useCallback((key: string) => {
    if (!/^\d$/.test(key)) return
    setError(false)
    setPin((p) => (p.length < CREW_PIN.length ? p + key : p))
  }, [])

  const del = useCallback(() => setPin((p) => p.slice(0, -1)), [])

  const submit = useCallback(() => {
    if (pin === CREW_PIN) onConfirm()
    else {
      setError(true)
      setPin('')
    }
  }, [pin, onConfirm])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Backspace') del()
      else if (e.key === 'Enter') submit()
      else if (e.key === 'Escape') onBack()
      else press(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [press, del, submit, onBack])

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
            <p className="lede">Enter the crew PIN for this flight.</p>

            <div className={`pin-dots ${error ? 'shake' : ''}`} aria-live="polite" aria-label={`${pin.length} digits entered`}>
              {Array.from({ length: CREW_PIN.length }, (_, i) => (
                <span key={i} className={i < pin.length ? 'dot filled' : 'dot'} />
              ))}
            </div>
            <p className={`hint ${error ? 'hint-error' : ''}`}>{error ? 'Incorrect PIN. Try again.' : ' '}</p>
          </div>

          <Keypad
            onKey={press}
            onDelete={del}
            onSubmit={submit}
            submitLabel="Sign in"
            canSubmit={pin.length === CREW_PIN.length}
          />
        </div>
      </div>
    </main>
  )
}
