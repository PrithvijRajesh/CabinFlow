import Icon from './Icon'

interface Props {
  // Extra keys shown in their own row above the digits (e.g. seat letters).
  letters?: string[]
  disabledLetters?: boolean
  onKey: (key: string) => void
  onDelete: () => void
  onSubmit: () => void
  submitLabel: string
  canSubmit: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// On-screen keypad for touch seatback screens. Physical keyboards are
// handled by the parent screens.
export default function Keypad({ letters, disabledLetters, onKey, onDelete, onSubmit, submitLabel, canSubmit }: Props) {
  return (
    <div className="keypad">
      {letters && (
        <div className="keypad-letters">
          {letters.map((l) => (
            <button key={l} type="button" className="key key-letter" disabled={disabledLetters} onClick={() => onKey(l)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="keypad-digits">
        {DIGITS.map((d) => (
          <button key={d} type="button" className="key" onClick={() => onKey(d)}>{d}</button>
        ))}
        <button type="button" className="key key-muted" onClick={onDelete} aria-label="Delete">
          <Icon name="delete" size={22} />
        </button>
        <button type="button" className="key" onClick={() => onKey('0')}>0</button>
        <button type="button" className="key key-go" disabled={!canSubmit} onClick={onSubmit} aria-label={submitLabel}>
          <Icon name="arrow" size={22} />
        </button>
      </div>
    </div>
  )
}
