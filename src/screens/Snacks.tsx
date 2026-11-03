import { useEffect, useRef, useState } from 'react'
import ErrorNotice from '../components/ErrorNotice'
import Icon from '../components/Icon'
import { useUndo } from '../context/useUndo'
import type { Cart } from '../hooks/useCart'
import { describePick, type SnackPickState } from '../hooks/useSnackPick'
import { ITEM_TAGS, type CartItem } from '../services/cart'
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
        <p className="eyebrow">Snacks & drinks</p>
        <h1 className="display">What can we <em>bring you</em>?</h1>
        <p className="lede">Pick one drink and one snack. It saves as you tap, and you can change it until the cart reaches your row.</p>
      </div>

      <p className="notice notice-row snack-free">
        <span><strong>Everything here is free.</strong> No need to ask the crew. They'll bring your pick to your seat.</span>
      </p>

      {(cart.error || picks.error) && (
        <ErrorNotice message={(cart.error ?? picks.error)!} onRetry={() => Promise.all([cart.retry(), picks.retry()])} />
      )}
      {ranOut.map((i) => (
        <p key={i.id} className="notice notice-warn">{i.name} just ran out. Pick another {i.kind}.</p>
      ))}

      {!cart.ready || !picks.ready ? (
        <div className="queue-card"><p className="eyebrow">Loading the cart…</p></div>
      ) : saved?.served_at && describePick(saved, cart.items) ? (
        // Handed over: the pick is locked so crew don't get a second order by accident.
        <div className="queue-card">
          <p className="eyebrow">Served</p>
          <p className="queue-big">Enjoy!</p>
          <p className="queue-sub">{describePick(saved, cart.items)}</p>
          <p className="queue-note">Want something else? Use Assistance and pick <strong>Water or a drink</strong>.</p>
        </div>
      ) : saved?.declined ? (
        <div className="queue-card">
          <p className="eyebrow">No thanks</p>
          <p className="queue-big">Got it</p>
          <p className="queue-sub">The crew will skip your seat when the cart comes by.</p>
          <div className="queue-actions">
            <button className="btn btn-ghost" disabled={picks.busy} onClick={() => void picks.save(EMPTY)}>Pick something after all</button>
          </div>
        </div>
      ) : cart.items.length === 0 ? (
        <div className="queue-card">
          <p className="eyebrow">Not yet</p>
          <p className="queue-sub">The crew hasn't set up the cart yet. Check back soon.</p>
        </div>
      ) : (
        <Picker cart={cart} picks={picks} />
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

  const summary = describePick(draft, cart.items)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  // Taps save on their own after a short pause, so "Coffee, cream, 1 sugar"
  // is one save. Leaving the screen sends whatever is still waiting.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const waiting = useRef<SnackPick | null>(null)
  const { save: savePick } = picks
  const send = async (next: SnackPick) => {
    waiting.current = null
    setFailed(false)
    const ok = await savePick(next)
    setSaving(false)
    setFailed(!ok)
    const text = describePick(next, cart.items)
    if (ok && text) undo.notify(`Saved: ${text}. The crew will bring it to your row.`)
  }
  useEffect(() => () => {
    clearTimeout(timer.current)
    if (waiting.current) void savePick(waiting.current)
  }, [savePick])

  const update = (next: SnackPick) => {
    undo.cancel('pick:clear') // a new pick replaces a pending clear
    setDraft(next)
    setSaving(true)
    waiting.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void send(next), 700)
  }

  const clearPick = () => {
    clearTimeout(timer.current)
    waiting.current = null
    setSaving(false)
    const before = draft
    setDraft(EMPTY)
    undo.defer({ key: 'pick:clear', message: 'Your pick was cleared', commit: () => picks.save(EMPTY), onUndo: () => setDraft(before) })
  }

  const choose = (item: CartItem) => {
    const d = draft
    if (item.kind === 'snack') return update({ ...d, snack_id: d.snack_id === item.id ? null : item.id })
    // Picking a drink resets its options to the defaults for its serve type.
    update(d.drink_id === item.id
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
                <Toggle label="Cream" options={[['Black', false], ['Cream', true]]} value={!!draft.cream} onChange={(cream) => update({ ...draft, cream })} />
                <Toggle label="Sugar" options={[['None', 0], ['1', 1], ['2', 2], ['3', 3]]} value={draft.sugar ?? 0} onChange={(sugar) => update({ ...draft, sugar })} />
              </>
            ) : (
              <Toggle label="Ice" options={[['Ice', true], ['No ice', false]]} value={draft.ice !== false} onChange={(ice) => update({ ...draft, ice })} />
            )}
          </div>
        )}
      </div>

      <div className="snack-group">
        <p className="eyebrow section-label">Snack</p>
        <ChoiceGrid items={snacks} selected={draft.snack_id} onChoose={choose} />
        {snacks.length > 0 && (
          <p className="queue-note">Allergy? Labels are a guide. Check the packet or ask the crew before eating.</p>
        )}
      </div>

      <div className="snack-bar">
        <div className="snack-summary">
          <span className={failed ? 'eyebrow hint-error' : 'eyebrow'}>
            {saving ? 'Saving…' : failed ? 'Not saved' : summary ? "Saved · no need to ask, it's on its way with the cart" : 'Nothing picked yet'}
          </span>
          <span className="snack-summary-text">{summary ?? 'Tap a drink and a snack.'}</span>
        </div>
        <div className="queue-actions">
          {failed && (
            <button className="btn btn-primary" disabled={picks.busy} onClick={() => { setSaving(true); void send(draft) }}>
              Try again <Icon name="arrow" size={18} />
            </button>
          )}
          {summary && !saving && (
            <button className="btn btn-quiet" disabled={picks.busy} onClick={clearPick}>Clear pick</button>
          )}
          {!summary && !saving && (
            <button className="btn btn-quiet" disabled={picks.busy} onClick={() => void picks.decline()}>No thanks, skip my seat</button>
          )}
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
          {i.tags?.length > 0 && (
            <span className="choice-tags">
              {ITEM_TAGS.filter((t) => i.tags.includes(t.tag)).map((t) => (
                <span key={t.tag} className={t.warn ? 'choice-tag is-warn' : 'choice-tag'}>{t.label}</span>
              ))}
            </span>
          )}
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
