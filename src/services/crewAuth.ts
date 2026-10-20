import { supabase } from '../lib/supabase'

// Crew accounts are Supabase Auth users that are also listed in crew_members.
// The session is remembered on the device, so crew sign in once per tablet.

function client() {
  if (!supabase) throw new Error('Backend not configured.')
  return supabase
}

// True when this device is signed in as a listed crew member.
export async function isSignedInCrew(): Promise<boolean> {
  const { data } = await client().auth.getSession()
  const user = data.session?.user
  if (!user) return false
  const { data: row } = await client().from('crew_members').select('user_id').eq('user_id', user.id).maybeSingle()
  return !!row
}

export async function signInCrew(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
  if (!(await isSignedInCrew())) {
    await client().auth.signOut()
    throw new Error('This account is not on the crew list.')
  }
}

export async function signOutCrew() {
  await client().auth.signOut()
}
