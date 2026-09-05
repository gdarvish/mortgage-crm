import { useMemo } from 'react'
import { useTheme } from '@/theme/ThemeContext'

/**
 * Recharts takes colours as prop values rather than as CSS, so a custom
 * property is no use to it — a chart drawn with literal hex keeps a pale grid
 * and grey ticks on the night palette. This reads the live theme instead.
 */
export function useChartTheme() {
  const theme = useTheme()
  return useMemo(() => ({
    /** <CartesianGrid {...grid} /> */
    grid: { strokeDasharray: '3 3', stroke: theme.borderLight },
    /** <XAxis tick={tick(11)} /> */
    tick: (fontSize = 12) => ({ fontSize, fill: theme.textMuted }),
    /** <Tooltip contentStyle={tooltip} /> */
    tooltip: {
      borderRadius: 10,
      border: `1px solid ${theme.border}`,
      background: theme.cardBg,
      color: theme.text,
      fontSize: 13,
    },
    /** Bare stroke colour, for props that take one. */
    gridStroke: theme.border,
    /** The series colour for single-series charts. */
    series: theme.primary,
  }), [theme])
}
