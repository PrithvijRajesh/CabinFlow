import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export const UNDO_SECONDS = 5
const NOTE_SECONDS = 4

// A destructive action held back for a few seconds so it can be undone.
export interface Undoable {
  key: string // what it hides while pending, e.g. `spot:<id>`
  message: string
  commit: () => Promise<unknown> | void
  onUndo?: () => void // restore anything the screen changed up front
}

export interface Toast {
  id: number
  message: string
  undoable: boolean
  seconds: number
}

export interface UndoValue {
  toast: Toast | null
  defer: (action: Undoable) => void
  notify: (message: string) => void // confirmation only, nothing to undo
  undo: () => void
  cancel: (key: string) => void // drop a pending action without running it
  isPending: (key: string) => boolean // true until it's undone or saved and refreshed
}

export const UndoContext = createContext<UndoValue | null>(null)

export function useUndo() {
  const ctx = useContext(UndoContext)
  if (!ctx) throw new Error('useUndo must be used inside AppShell')
  return ctx
}

// One toast at a time. A new one sends any pending action right away.
export function useUndoQueue(): UndoValue {
  const [toast, setToast] = useState<Toast | null>(null)
  const [hidden, setHidden] = useState<string[]>([])
  const pending = useRef<Undoable | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nextId = useRef(0)

  const clear = useCallback(() => {
    clearTimeout(timer.current)
    pending.current = null
    setToast(null)
  }, [])

  // Keep it hidden until the hook has refreshed, so it doesn't flash back.
  const flush = useCallback(() => {
    const p = pending.current
    clear()
    if (p) void Promise.resolve(p.commit()).finally(() => setHidden((h) => h.filter((k) => k !== p.key)))
  }, [clear])

  const show = useCallback((message: string, undoable: boolean) => {
    const seconds = undoable ? UNDO_SECONDS : NOTE_SECONDS
    setToast({ id: ++nextId.current, message, undoable, seconds })
    timer.current = setTimeout(flush, seconds * 1000)
  }, [flush])

  const defer = useCallback((action: Undoable) => {
    flush()
    pending.current = action
    setHidden((h) => [...h, action.key])
    show(action.message, true)
  }, [flush, show])

  const notify = useCallback((message: string) => {
    flush()
    show(message, false)
  }, [flush, show])

  const cancel = useCallback((key: string) => {
    if (pending.current?.key !== key) return
    clear()
    setHidden((h) => h.filter((k) => k !== key))
  }, [clear])

  const undo = useCallback(() => {
    if (!pending.current) return
    pending.current.onUndo?.()
    cancel(pending.current.key)
  }, [cancel])

  // Leaving the app shell (sign out) still sends what's pending.
  useEffect(() => flush, [flush])

  const isPending = useCallback((key: string) => hidden.includes(key), [hidden])

  return { toast, defer, notify, undo, cancel, isPending }
}
