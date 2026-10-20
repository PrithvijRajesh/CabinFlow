import { useState, type FormEvent } from 'react'
import Icon from '../components/Icon'
import { useFlight } from '../context/useFlight'
import { useCart, type Cart } from '../hooks/useCart'
import type { CartItem, ItemKind } from '../services/cart'

export default function CrewCart() {
  const { flightId } = useFlight()
  const cart = useCart(flightId)
  const out = cart.items.filter((i) => !i.in_stock).length

  return (
    <section className="crew-cart">
      <div className="hero">
        <p className="eyebrow">Snack cart · complimentary</p>
        <h1 className="display">
          {String(cart.items.length).padStart(2, '0')} <span className="dim">items{out > 0 && ` · ${out} out`}</span>
        </h1>
        <p className="lede">Set what's on the cart. Passengers pick from this list.</p>
      </div>

      {cart.error && <p className="notice notice-error">{cart.error}</p>}

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
    </section>
  )
}

function ItemList({ title, items, cart }: { title: string; items: CartItem[]; cart: Cart }) {
  return (
    <div className="crew-list">
      <p className="eyebrow section-label">{title} · {items.length}</p>
      {items.length === 0 ? (
        <p className="crew-empty">None yet.</p>
      ) : (
        <ul className="crew-rows">
          {items.map((item) => (
            <li key={item.id} className={item.in_stock ? 'cart-row' : 'cart-row is-out'}>
              <span className="cart-name">{item.name}</span>
              <span className="crew-actions">
                <button
                  className={item.in_stock ? 'btn-mini' : 'btn-mini btn-mini-out'}
                  disabled={cart.busy}
                  onClick={() => cart.setStock(item.id, !item.in_stock)}
                  aria-pressed={!item.in_stock}
                >
                  {item.in_stock ? 'In stock' : 'Out'}
                </button>
                <button className="btn-mini btn-mini-danger" disabled={cart.busy} onClick={() => cart.remove(item.id)} aria-label={`Remove ${item.name}`}>
                  <Icon name="delete" size={16} />
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
  const [kind, setKind] = useState<ItemKind>('drink')
  const [hint, setHint] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    if (cart.items.some((i) => i.name.toLowerCase() === clean.toLowerCase())) {
      setHint(`${clean} is already on the cart.`)
      return
    }
    await cart.add(clean, kind)
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
          {(['drink', 'snack'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={kind === k ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setKind(k)}
            >
              <Icon name={k === 'drink' ? 'cup' : 'cart'} size={16} /> {k === 'drink' ? 'Drink' : 'Snack'}
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
