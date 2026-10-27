import { useCallback, useEffect, useState } from 'react'
import { SEAT_LETTERS, SEAT_PATTERN } from '../data/flight'
import Icon from '../components/Icon'
import Keypad from '../components/Keypad'

interface Props {
  onConfirm: (seat: string) => void
  onBack: () => void
}

export default function SeatEntry({ onConfirm, onBack }: Props) {
  const [{ row, letter }, setSeat] = useState({ row: '', letter: '' })

  const seat = row + letter
  const valid = SEAT_PATTERN.test(seat)
  const rowTooHigh = Number(row) > 60

  // Functional updates so rapid key presses never read stale state.
  const press = useCallback((key: string) => {
    setSeat((s) => {
      if (/^\d$/.test(key)) {
        if (s.letter || s.row.length >= 2 || (s.row === '' && key === '0')) return s
        return { ...s, row: s.row + key }
      }
      if (SEAT_LETTERS.includes(key) && s.row && Number(s.row) <= 60) return { ...s, letter: key }
      return s
    })
  }, [])

  const del = useCallback(() => {
    setSeat((s) => (s.letter ? { ...s, letter: '' } : { ...s, row: s.row.slice(0, -1) }))
  }, [])

  const submit = useCallback(() => {
    if (valid) onConfirm(seat)
  }, [valid, seat, onConfirm])

  // Physical keyboard support alongside the on-screen keypad.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Backspace') del()
      else if (e.key === 'Enter') submit()
      else if (e.key === 'Escape') onBack()
      else press(e.key.toUpperCase())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [press, del, submit, onBack])

  return (
    <main className="entry">
      <div className="pass">
        <section className="pass-main">
          <header className="pass-head">
            <button className="back-btn" onClick={onBack}>
              <Icon name="back" size={18} /> Back
            </button>
            <span className="eyebrow">Passenger</span>
          </header>

          <h1 className="display">Where are you sitting?</h1>
          <p className="lede">Your seat lets the crew bring requests straight to you. We don't store your name.</p>

          <div className="seat-readout" aria-live="polite">
            <div className="readout-field">
              <span className="readout-label">Row</span>
              <span className={`readout-value ${row ? '' : 'empty'}`}>{row || '00'}</span>
            </div>
            <div className="readout-field">
              <span className="readout-label">Seat</span>
              <span className={`readout-value accent ${letter ? '' : 'empty'}`}>{letter || '–'}</span>
            </div>
          </div>
          <p className={`hint ${rowTooHigh ? 'hint-error' : ''}`}>
            {rowTooHigh
              ? 'Rows go from 1 to 60.'
              : !row
                ? 'Type your row number.'
                : !letter
                  ? 'Now pick your seat letter.'
                  : `Seat ${seat}. Tap the arrow to continue.`}
          </p>
        </section>

        <div className="pass-perf" aria-hidden />

        <section className="pass-stub">
          <Keypad
            letters={SEAT_LETTERS}
            disabledLetters={!row || rowTooHigh}
            onKey={press}
            onDelete={del}
            onSubmit={submit}
            submitLabel="Continue"
            canSubmit={valid}
          />
        </section>
      </div>
    </main>
  )
}
