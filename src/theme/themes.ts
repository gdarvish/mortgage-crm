// Color themes from the CRM design handoff. Earth is the default.
export type ThemeId = 'earth' | 'deep' | 'night'

export interface Theme {
  id: ThemeId
  name: string
  nav: string
  navActive: string
  navText: string
  navTextActive: string
  primary: string
  primaryHover: string
  primaryText: string
  bg: string
  cardBg: string
  border: string
  borderLight: string
  text: string
  textSub: string
  textMuted: string
  accent: string
  accentBg: string
  danger: string
  dangerBg: string
  success: string
  successBg: string
  warning: string
  warningBg: string
  info: string
  infoBg: string
  shadow: string
  shadowHover: string
  inputBg: string
  pillBg: string
  pillText: string
}

export const THEMES: Record<ThemeId, Theme> = {
  earth: {
    id: 'earth',
    name: '🌿 אדמה',
    nav: '#1c1917',
    navActive: '#292524',
    navText: '#a8a29e',
    navTextActive: '#fafaf9',
    primary: '#059669',
    primaryHover: '#047857',
    primaryText: '#fff',
    bg: '#faf9f7',
    cardBg: '#fff',
    border: '#e7e5e4',
    borderLight: '#f5f4f2',
    text: '#1c1917',
    textSub: '#57534e',
    textMuted: '#a8a29e',
    accent: '#d97706',
    accentBg: '#fef3c7',
    danger: '#dc2626',
    dangerBg: '#fee2e2',
    success: '#059669',
    successBg: '#d1fae5',
    warning: '#d97706',
    warningBg: '#fef3c7',
    info: '#0ea5e9',
    infoBg: '#e0f2fe',
    shadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
    shadowHover: '0 4px 24px rgba(28,25,23,0.14)',
    inputBg: '#faf9f7',
    pillBg: '#f5f4f2',
    pillText: '#57534e',
  },
  deep: {
    id: 'deep',
    name: '🌊 כחול עמוק',
    nav: '#1a3554',
    navActive: '#1e4068',
    navText: '#7ea3c0',
    navTextActive: '#e8f4ff',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryText: '#fff',
    bg: '#f0f4f9',
    cardBg: '#fff',
    border: '#dbeafe',
    borderLight: '#eff6ff',
    text: '#0f2440',
    textSub: '#476285',
    textMuted: '#7ea3c0',
    accent: '#f59e0b',
    accentBg: '#fffbeb',
    danger: '#ef4444',
    dangerBg: '#fee2e2',
    success: '#10b981',
    successBg: '#ecfdf5',
    warning: '#f59e0b',
    warningBg: '#fffbeb',
    info: '#6366f1',
    infoBg: '#eef2ff',
    shadow: '0 1px 4px rgba(26,53,84,0.06), 0 6px 20px rgba(26,53,84,0.1)',
    shadowHover: '0 4px 24px rgba(26,53,84,0.18)',
    inputBg: '#f0f4f9',
    pillBg: '#eff6ff',
    pillText: '#3b82f6',
  },
  night: {
    id: 'night',
    name: '🌙 מצב לילה',
    nav: '#0a0908',
    navActive: '#171310',
    navText: '#78716c',
    navTextActive: '#fafaf9',
    primary: '#10b981',
    primaryHover: '#059669',
    primaryText: '#fff',
    bg: '#141210',
    cardBg: '#1c1917',
    border: '#292524',
    borderLight: '#211e1b',
    text: '#fafaf9',
    textSub: '#a8a29e',
    textMuted: '#57534e',
    accent: '#f59e0b',
    accentBg: '#1a1200',
    danger: '#ef4444',
    dangerBg: '#2d1010',
    success: '#10b981',
    successBg: '#051a10',
    warning: '#f59e0b',
    warningBg: '#1a1100',
    info: '#38bdf8',
    infoBg: '#041825',
    shadow: '0 1px 4px rgba(0,0,0,0.25), 0 6px 20px rgba(0,0,0,0.35)',
    shadowHover: '0 4px 28px rgba(0,0,0,0.5)',
    inputBg: '#211e1b',
    pillBg: '#292524',
    pillText: '#a8a29e',
  },
}
