import { useState, type FormEvent } from 'react'
import ErrorNotice from '../components/ErrorNotice'
import Icon from '../components/Icon'
import { useUndo } from '../context/useUndo'
import type { Cart } from '../hooks/useCart'
import type { CrewPicks } from '../hooks/useCrewPicks'
import CrewOrders from './CrewOrders'
import type { CartItem, ItemKind, Serve } from '../services/cart'
import type { IconName } from '../components/Icon'

// What the crew pick when adding an item.
const ITEM_TYPES: { label: string; kind: ItemKind; serve: Serve | null; icon: IconName }[] = [
  { label: 'Cold drink', kind: 'drink', serve: 'cold', icon: 'cup' },
  { label: 'Hot drink', kind: 'drink', serve: 'hot', icon: 'cup' },
  { label: 'Plain drink', kind: 'drink', serve: 'plain', icon: 'cup' },
  { label: 'Snack', kind: 'snack', serve: null, icon: 'cart' },
]

export default function CrewCart({ cart: live, orders }: { cart: Cart; orders: CrewPicks }) {
  // Removed items stay hidden while their undo is pending.
  const undo = useUndo()
  const cart = { ...live, items: live.items.filter((i) => !undo.isPending(`item:${i.id}`)) }
  // Orders is the everyday view; setup comes first only while the cart is empty.
  const [tab, setTab] = useState<'orders' | 'setup' | null>(null)
  const current = tab ?? (cart.ready && cart.items.length === 0 ? 'setup' : 'orders')

  return (
    <section className="crew-cart">
      <div className="seg tabs" role="tablist" aria-label="Cart sections">
        {(['orders', 'setup'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={current === t} className={current === t ? 'seg-btn active' : 'seg-btn'} onClick={() => setTab(t)}>
            {t === 'orders' ? 'Orders' : 'Cart setup'}
          </button>
        ))}
      </div>

      {current === 'orders' ? <CrewOrders cart={cart} orders={orders} /> : <CartSetup cart={cart} />}
    </section>
  )
}

function CartSetup({ cart }: { cart: Cart }) {
  const out = cart.items.filter((i) => !i.in_stock).length

  return (
    <>
      <div className="hero">
        <p className="eyebrow">Snack cart · complimentary</p>
        <h1 className="display">
          {String(cart.items.length).padStart(2, '0')} <span className="dim">items{out > 0 && ` · ${out} out`}</span>
        </h1>
        <p className="lede">Set what's on the cart. Passengers pick from this list.</p>
      </div>

      {cart.error && <ErrorNotice message={cart.error} onRetry={cart.retry} />}

      {!cart.ready ? (
        <p className="crew-empty">Loading cart…</p>
      ) : cart.items.length === 0 ? (
        <div className="cart-empty">
          <p className="now-sub">The cart is empty. Start from the standard cart, then adjust.</p>
          <div className="queue-actions">
            <button className="btn btn-primary" disabled={cart.busy || !!cart.error} onClick={cart.loadStandard}>
              Load standard cart <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="cart-grid">
          <ItemList title="Drinks" items={cart.items.filter((i) => i.kind === 'drink')} cart={cart} />
          <ItemList title="Snacks" items={cart.items.filter((i) => i.kind === 'snack')} cart={cart} />
        </div>
      )}

      <AddItem cart={cart} />
    </>
  )
}

function ItemList({ title, items, cart }: { title: string; items: CartItem[]; cart: Cart }) {
  const undo = useUndo()
  return (
    <div className="crew-list">
      <p className="eyebrow section-label">{title} · {items.length}</p>
      {items.length === 0 ? (
        <p className="crew-empty">None yet.</p>
      ) : (
        <ul className="crew-rows">
          {items.map((item) => (
            <li key={item.id} className={item.in_stock ? 'cart-row' : 'cart-row is-out'}>
              <span className="cart-name">{item.name}{(item.serve === 'hot' || item.serve === 'plain') && <span className="cart-tag">{item.serve}</span>}</span>
              <span className="crew-actions">
                <button
                  className={item.in_stock ? 'btn-mini' : 'btn-mini btn-mini-out'}
                  disabled={cart.busy}
                  onClick={() => cart.setStock(item.id, !item.in_stock)}
                  aria-pressed={!item.in_stock}
                >
                  {item.in_stock ? 'In stock' : 'Out'}
                </button>
                <button className="btn-mini btn-mini-danger" disabled={cart.busy} onClick={() => undo.defer({ key: `item:${item.id}`, message: `Removed ${item.name} from the cart`, commit: () => cart.remove(item.id) })} aria-label={`Remove ${item.name}`}>
                  <Icon name="trash" size={18} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddItem({ cart }: { cart: Cart }) {
  const [name, setName] = useState('')
  const [type, setType] = useState(0)
  const [hint, setHint] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    if (cart.items.some((i) => i.name.toLowerCase() === clean.toLowerCase())) {
      setHint(`${clean} is already on the cart.`)
      return
    }
    const t = ITEM_TYPES[type]
    await cart.add(clean, t.kind, t.serve)
    setName('')
  }

  return (
    <form className="cart-add" onSubmit={submit}>
      <p className="eyebrow section-label">Add an item</p>
      <div className="cart-add-row">
        <input
          className="lookup-input"
          value={name}
          onChange={(e) => { setName(e.target.value); setHint('') }}
          placeholder="e.g. Ginger ale"
          maxLength={40}
          aria-label="Item name"
        />
        <div className="seg" role="radiogroup" aria-label="Type">
          {ITEM_TYPES.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="radio"
              aria-checked={type === i}
              className={type === i ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setType(i)}
            >
              <Icon name={t.icon} size={16} /> {t.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" disabled={cart.busy || !name.trim() || !!cart.error}>Add</button>
      </div>
      {hint && <p className="hint hint-error">{hint}</p>}
      {cart.items.length > 0 && (
        <button type="button" className="link-btn" disabled={cart.busy} onClick={cart.loadStandard}>
          Add any missing standard items
        </button>
      )}
    </form>
  )
}
