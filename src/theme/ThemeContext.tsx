import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { THEMES, type Theme, type ThemeId } from './themes'

const STORAGE_KEY = 'crm-theme'

interface ThemeContextValue {
  theme: Theme
  themeId: ThemeId
  setThemeId: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Mirror the theme palette onto CSS custom properties so Tailwind utilities
// that reference --color-* tokens flip alongside the inline-styled components.
function applyCssVars(theme: Theme) {
  const root = document.documentElement
  const vars: Record<string, string> = {
    '--color-nav-bg': theme.nav,
    '--color-nav-active': theme.navActive,
    '--color-nav-text': theme.navText,
    '--color-nav-text-active': theme.navTextActive,
    '--color-primary': theme.primary,
    '--color-primary-hover': theme.primaryHover,
    '--color-bg': theme.bg,
    '--color-card': theme.cardBg,
    '--color-border': theme.border,
    '--color-border-light': theme.borderLight,
    '--color-text': theme.text,
    '--color-text-sub': theme.textSub,
    '--color-text-muted': theme.textMuted,
    '--color-accent': theme.accent,
    '--color-accent-bg': theme.accentBg,
    '--color-danger': theme.danger,
    '--color-danger-bg': theme.dangerBg,
    '--color-success': theme.success,
    '--color-success-bg': theme.successBg,
  }
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  root.setAttribute('data-theme', theme.id)
  document.body.style.background = theme.bg
  document.body.style.color = theme.text
}

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'earth' || stored === 'deep' || stored === 'night') return stored
  } catch {
    /* localStorage unavailable */
  }
  return 'earth'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(readStoredTheme)
  const theme = THEMES[themeId]

  useEffect(() => {
    applyCssVars(theme)
  }, [theme])

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* localStorage unavailable */
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx.theme
}

export function useThemeControls(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeControls must be used within a ThemeProvider')
  return ctx
}
