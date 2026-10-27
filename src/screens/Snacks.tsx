import { useState } from 'react'
import ErrorNotice from '../components/ErrorNotice'
import Icon from '../components/Icon'
import { useUndo } from '../context/useUndo'
import type { Cart } from '../hooks/useCart'
import { describePick, type SnackPickState } from '../hooks/useSnackPick'
import type { CartItem } from '../services/cart'
import type { SnackPick } from '../services/snackPicks'

const EMPTY: SnackPick = { drink_id: null, snack_id: null, ice: null, cream: null, sugar: null }

export default function Snacks({ cart, picks }: { cart: Cart; picks: SnackPickState }) {
  const saved = picks.pick
  const savedDrink = cart.items.find((i) => i.id === saved?.drink_id)
  const savedSnack = cart.items.find((i) => i.id === saved?.snack_id)
  const ranOut = [savedDrink, savedSnack].filter((i): i is CartItem => !!i && !i.in_stock)

  return (
    <section className="snacks">
      <div className="hero">
        <p className="eyebrow">Snacks & drinks · complimentary</p>
        <h1 className="display">What can we <em>bring you</em>?</h1>
        <p className="lede">Pick one drink and one snack. The crew will have it ready when the cart reaches your row. You can change it until then.</p>
      </div>

      {(cart.error || picks.error) && (
        <ErrorNotice message={(cart.error ?? picks.error)!} onRetry={() => Promise.all([cart.retry(), picks.retry()])} />
      )}
      {ranOut.map((i) => (
        <p key={i.id} className="notice notice-warn">{i.name} just ran out. Pick another {i.kind}.</p>
      ))}

      {!cart.ready || !picks.ready ? (
        <div className="queue-card"><p className="eyebrow">Loading the cart…</p></div>
      ) : cart.items.length === 0 ? (
        <div className="queue-card">
          <p className="eyebrow">Not yet</p>
          <p className="queue-sub">The crew hasn't set up the cart yet. Check back soon.</p>
        </div>
      ) : (
        // Remount when the saved pick changes, so the draft starts from it.
        <Picker key={JSON.stringify(saved)} cart={cart} picks={picks} />
      )}
    </section>
  )
}

function Picker({ cart, picks }: { cart: Cart; picks: SnackPickState }) {
  const saved = picks.pick ?? EMPTY
  const undo = useUndo()
  const available = (id: string | null) => cart.items.some((i) => i.id === id && i.in_stock)

  // Start from the saved pick, minus anything that has since run out.
  const [draft, setDraft] = useState<SnackPick>(() => ({
    ...saved,
    drink_id: available(saved.drink_id) ? saved.drink_id : null,
    snack_id: available(saved.snack_id) ? saved.snack_id : null,
  }))

  const drinks = cart.items.filter((i) => i.kind === 'drink')
  const snacks = cart.items.filter((i) => i.kind === 'snack')
  const drink = drinks.find((i) => i.id === draft.drink_id)

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const hasSaved = !!(picks.pick && (picks.pick.drink_id || picks.pick.snack_id))
  const summary = describePick(draft, cart.items)

  async function save() {
    undo.cancel('pick:clear')
    if (await picks.save(draft)) undo.notify('Pick saved. The crew will bring it to your row.')
  }

  const choose = (item: CartItem) => {
    if (item.kind === 'snack') {
      setDraft((d) => ({ ...d, snack_id: d.snack_id === item.id ? null : item.id }))
      return
    }
    // Picking a drink resets its options to the defaults for its serve type.
    setDraft((d) => d.drink_id === item.id
      ? { ...d, drink_id: null, ice: null, cream: null, sugar: null }
      : item.serve === 'hot'
        ? { ...d, drink_id: item.id, ice: null, cream: false, sugar: 0 }
        : item.serve === 'plain'
          ? { ...d, drink_id: item.id, ice: null, cream: null, sugar: null }
          : { ...d, drink_id: item.id, ice: true, cream: null, sugar: null })
  }

  return (
    <div className="snack-layout">
      <div className="snack-group">
        <p className="eyebrow section-label">Drink</p>
        <ChoiceGrid items={drinks} selected={draft.drink_id} onChoose={choose} />

        {drink && drink.serve !== 'plain' && (
          <div className="drink-options">
            {drink.serve === 'hot' ? (
              <>
                <Toggle label="Cream" options={[['Black', false], ['Cream', true]]} value={!!draft.cream} onChange={(cream) => setDraft((d) => ({ ...d, cream }))} />
                <Toggle label="Sugar" options={[['None', 0], ['1', 1], ['2', 2], ['3', 3]]} value={draft.sugar ?? 0} onChange={(sugar) => setDraft((d) => ({ ...d, sugar }))} />
              </>
            ) : (
              <Toggle label="Ice" options={[['Ice', true], ['No ice', false]]} value={draft.ice !== false} onChange={(ice) => setDraft((d) => ({ ...d, ice }))} />
            )}
          </div>
        )}
      </div>

      <div className="snack-group">
        <p className="eyebrow section-label">Snack</p>
        <ChoiceGrid items={snacks} selected={draft.snack_id} onChoose={choose} />
      </div>

      <div className="snack-bar">
        <div className="snack-summary">
          <span className="eyebrow">{dirty ? 'Your pick' : hasSaved ? 'Saved' : 'Nothing picked yet'}</span>
          <span className="snack-summary-text">{summary ?? 'Tap a drink and a snack.'}</span>
        </div>
        <div className="queue-actions">
          {hasSaved && (
            <button className="btn btn-quiet" disabled={picks.busy} onClick={() => undo.defer({ key: 'pick:clear', message: 'Your pick was cleared', commit: () => picks.save(EMPTY) })}>Clear pick</button>
          )}
          <button className="btn btn-primary" disabled={picks.busy || !dirty || !summary} onClick={() => void save()}>
            {picks.busy ? 'Saving…' : hasSaved ? 'Update pick' : 'Save my pick'} <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ChoiceGrid({ items, selected, onChoose }: { items: CartItem[]; selected: string | null; onChoose: (i: CartItem) => void }) {
  if (items.length === 0) return <p className="queue-note">None on the cart today.</p>
  return (
    <div className="choices">
      {items.map((i) => (
        <button
          key={i.id}
          className={i.id === selected ? 'choice active' : 'choice'}
          disabled={!i.in_stock}
          aria-pressed={i.id === selected}
          onClick={() => onChoose(i)}
        >
          {i.name}
          {!i.in_stock && <span className="choice-note">Out</span>}
        </button>
      ))}
    </div>
  )
}

function Toggle<T extends string | number | boolean>({ label, options, value, onChange }: {
  label: string
  options: [string, T][]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="opt">
      <span className="opt-label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map(([text, v]) => (
          <button key={text} type="button" role="radio" aria-checked={value === v} className={value === v ? 'seg-btn active' : 'seg-btn'} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
