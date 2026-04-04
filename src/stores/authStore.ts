import { create } from 'zustand'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
}

interface AuthActions {
  initialize: () => () => void
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

export type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  initialize: () => {
    // Get the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
      })
    })

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      })
    })

    // Return unsubscribe function for cleanup
    return () => {
      subscription.unsubscribe()
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      set({ loading: false })
    }
    // On success, onAuthStateChange will update the state
    return { error }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true })
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) {
      set({ loading: false })
    }
    // On success, onAuthStateChange will update the state
    return { error }
  },

  signOut: async () => {
    set({ loading: true })
    await supabase.auth.signOut()
    // onAuthStateChange will set user/session to null
  },
}))
