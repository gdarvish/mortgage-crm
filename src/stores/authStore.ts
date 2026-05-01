import { create } from 'zustand'
import {
  type User,
  type AuthError,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthState {
  user: User | null
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

export const useAuthStore = create<AuthStore>((set, _get) => ({
  user: null,
  loading: true,
  initialized: false,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({
        user,
        loading: false,
        initialized: true,
      })
    })

    return unsubscribe
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return { error: null }
    } catch (error) {
      set({ loading: false })
      return { error: error as AuthError }
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true })
    try {
      await createUserWithEmailAndPassword(auth, email, password)
      return { error: null }
    } catch (error) {
      set({ loading: false })
      return { error: error as AuthError }
    }
  },

  signOut: async () => {
    set({ loading: true })
    await fbSignOut(auth)
  },
}))
