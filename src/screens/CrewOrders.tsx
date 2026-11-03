import type { Cart } from '../hooks/useCart'
import ErrorNotice from '../components/ErrorNotice'
import type { CrewPicks } from '../hooks/useCrewPicks'
import { describePick } from '../hooks/useSnackPick'
import type { CartItem } from '../services/cart'
import type { CrewPick } from '../services/snackPicks'

interface Total {
  item: CartItem
  count: number
  detail: string
}

// What to load on the cart: one line per item still to serve, with the extras.
function loadUp(picks: CrewPick[], items: CartItem[]): Total[] {
  return items.flatMap((item) => {
    const mine = picks.filter((p) => p.drink_id === item.id || p.snack_id === item.id)
    if (mine.length === 0) return []
    const parts: string[] = []
    if (item.serve === 'hot') {
      const cream = mine.filter((p) => p.cream).length
      const sugar = mine.reduce((n, p) => n + (p.sugar ?? 0), 0)
      if (cream) parts.push(`${cream} cream`)
      if (sugar) parts.push(`${sugar} sugar`)
    } else if (item.serve === 'cold') {
      const noIce = mine.filter((p) => p.ice === false).length
      if (noIce) parts.push(`${noIce} no ice`)
    }
    return [{ item, count: mine.length, detail: parts.join(' · ') }]
  })
}

export default function CrewOrders({ cart, orders }: { cart: Cart; orders: CrewPicks }) {
  // A pick whose items were all removed from the cart is no longer an order.
  const placed = orders.picks.filter((p) => p.drink_id || p.snack_id)
  // Seats that said "No thanks", front to back, so crew can skip them.
  const declined = orders.picks.filter((p) => p.declined).map((p) => p.seat)
    .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
  const toServe = placed.filter((p) => !p.served_at)
  const totals = loadUp(toServe, cart.items)
  const drinks = totals.filter((t) => t.item.kind === 'drink')
  const snacks = totals.filter((t) => t.item.kind === 'snack')

  return (
    <>
      <div className="hero">
        <p className="eyebrow">Orders · front to back</p>
        <h1 className="display">
          {String(toServe.length).padStart(2, '0')} <span className="dim">to serve{placed.length > 0 && ` of ${placed.length}`}</span>
        </h1>
        <p className="lede">Load the cart from the totals, then work down the aisle.</p>
      </div>

      {(orders.error || cart.error) && (
        <ErrorNotice message={(orders.error ?? cart.error)!} onRetry={() => Promise.all([orders.retry(), cart.retry()])} />
      )}

      {!orders.ready || !cart.ready ? (
        <p className="crew-empty">Loading orders…</p>
      ) : placed.length === 0 ? (
        <>
          <p className="crew-empty">No picks yet. They appear here as passengers choose.</p>
          {declined.length > 0 && <p className="crew-empty">No thanks · {declined.join(', ')}</p>}
        </>
      ) : (
        <div className="cart-grid">
          <div className="crew-list">
            <p className="eyebrow section-label">Load the cart · still to serve</p>
            {totals.length === 0 ? (
              <p className="crew-empty">Everything has been served.</p>
            ) : (
              <ul className="crew-rows">
                {[...drinks, ...snacks].map((t) => (
                  <li key={t.item.id} className="total-row">
                    <span className="total-count">×{t.count}</span>
                    <span className="cart-name">{t.item.name}{!t.item.in_stock && <span className="cart-tag">out</span>}</span>
                    <span className="crew-wait">{t.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="crew-list">
            <p className="eyebrow section-label">By seat · {placed.length}</p>
            {declined.length > 0 && <p className="crew-empty">No thanks, skip · {declined.join(', ')}</p>}
            <ul className="crew-rows">
              {placed.map((p) => (
                <li key={p.seat} className={p.served_at ? 'order-row is-served' : 'order-row'}>
                  <span className="crew-seat">{p.seat}</span>
                  <span className="order-text">{describePick(p, cart.items)}</span>
                  <button
                    className={p.served_at ? 'btn-mini btn-mini-done' : 'btn-mini'}
                    disabled={orders.busy}
                    aria-pressed={!!p.served_at}
                    onClick={() => orders.markServed(p.seat, !p.served_at)}
                  >
                    {p.served_at ? 'Served ✓' : 'Served'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
