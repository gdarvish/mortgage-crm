import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

/**
 * Convenience hook that re-exports auth state and actions from the store.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const initialized = useAuthStore((s) => s.initialized)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const signOut = useAuthStore((s) => s.signOut)

  return { user, loading, initialized, signIn, signUp, signOut }
}

/**
 * Hook that redirects to /login if the user is not authenticated.
 * Returns the current auth state so callers can show a loading indicator
 * while initialization is in progress.
 */
export function useRequireAuth() {
  const { user, loading, initialized, ...rest } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (initialized && !loading && !user) {
      navigate('/login', { replace: true })
    }
  }, [initialized, loading, user, navigate])

  return { user, loading, initialized, ...rest }
}
