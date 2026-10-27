import { useState } from 'react'
import Icon from './Icon'

// Error banner: what went wrong in plain words, plus a way to recover.
export default function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => Promise<unknown> | void }) {
  const [trying, setTrying] = useState(false)

  async function retry() {
    setTrying(true)
    try {
      await onRetry?.()
    } finally {
      setTrying(false)
    }
  }

  return (
    <div className="notice notice-error" role="alert">
      <Icon name="alert" size={20} className="notice-icon" />
      <span className="notice-text">{message}</span>
      {onRetry && (
        <button className="btn-mini" disabled={trying} onClick={() => void retry()}>
          {trying ? 'Trying…' : 'Try again'}
        </button>
      )}
    </div>
  )
}
