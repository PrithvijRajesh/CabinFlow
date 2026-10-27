// What people see when something fails. Messages we wrote ourselves (SQL
// functions, Edge Functions, sign-in) are already plain language and pass
// through. Anything else (Postgres, network, HTTP codes) is logged for us and
// replaced by the caller's fallback.
const PLAIN = [
  /^That (drink|snack) is not available\.$/,
  /^Wrong email or password\.$/,
  /^This account is not on the crew list\.$/,
  /^Enter a flight number like /,
  /^No flight found for /,
]

const REWRITE: Record<string, string> = {
  'Crew sign-in required.': 'Your crew sign-in has ended. Sign out, then sign in again.',
}

export const NO_BACKEND = "This screen isn't connected to the cabin system yet."
const OFFLINE = 'No connection to the cabin system. It usually comes back on its own, so try again in a minute.'

export function friendlyError(e: unknown, fallback: string) {
  // Supabase errors are plain objects with a message, not Error instances.
  const msg = (e as { message?: unknown } | null)?.message
  const text = typeof msg === 'string' ? msg : ''
  if (REWRITE[text]) return REWRITE[text]
  if (PLAIN.some((p) => p.test(text))) return text
  console.error(e)
  if (typeof navigator !== 'undefined' && !navigator.onLine) return OFFLINE
  return fallback
}
