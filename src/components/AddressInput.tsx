import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useTheme } from '@/theme/ThemeContext'

export interface AddressSuggestion {
  text: string
  x: number
  y: number
}

export interface AddressInputProps {
  value: string
  onChange: (text: string) => void
  onSelect?: (s: AddressSuggestion) => void
  placeholder?: string
  label?: string
  icon?: ReactNode
  disabled?: boolean
  dir?: 'rtl' | 'ltr'
}

interface GovMapAddressResult {
  ResultLable: string
  ResultType?: number
  X: number
  Y: number
  Created?: string
}

interface GovMapResponse {
  res?: {
    ADDRESS?: GovMapAddressResult[]
    [key: string]: unknown
  }
}

const GOVMAP_URL = 'https://es.govmap.gov.il/TldSearch/api/AutoComplete'
const DEBOUNCE_MS = 250
const MIN_CHARS = 2
const MAX_RESULTS = 8

export function AddressInput({
  value,
  onChange,
  onSelect,
  placeholder,
  label,
  icon,
  disabled,
  dir = 'rtl',
}: AddressInputProps) {
  const t = useTheme()
  const [suggestions, setSuggestions] = useState<GovMapAddressResult[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [hoverIndex, setHoverIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextFetchRef = useRef(false)

  // Click outside closes dropdown
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Debounced fetch on value changes
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    const trimmed = value.trim()
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([])
      setOpen(false)
      setHighlight(-1)
      return
    }

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      fetch(GOVMAP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: trimmed, LstResult: null }),
        signal: controller.signal,
      })
        .then(r => (r.ok ? (r.json() as Promise<GovMapResponse>) : null))
        .then(data => {
          if (!data) {
            setSuggestions([])
            setOpen(false)
            return
          }
          const addrs = data.res?.ADDRESS ?? []
          const sliced = addrs.slice(0, MAX_RESULTS)
          setSuggestions(sliced)
          setHighlight(-1)
          setOpen(sliced.length > 0)
        })
        .catch(() => {
          // Silently ignore (CORS / network / abort)
          setSuggestions([])
          setOpen(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  const selectSuggestion = useCallback(
    (s: GovMapAddressResult) => {
      skipNextFetchRef.current = true
      onChange(s.ResultLable)
      if (onSelect) onSelect({ text: s.ResultLable, x: s.X, y: s.Y })
      setOpen(false)
      setHighlight(-1)
      setSuggestions([])
    },
    [onChange, onSelect],
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < suggestions.length) {
        e.preventDefault()
        selectSuggestion(suggestions[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  const labelStyle: CSSProperties = useMemo(
    () => ({
      display: 'block',
      fontSize: 12,
      fontWeight: 600,
      color: t.textMuted,
      marginBottom: 5,
    }),
    [t.textMuted],
  )

  const inputStyle: CSSProperties = useMemo(
    () => ({
      width: '100%',
      padding: icon ? (dir === 'rtl' ? '10px 38px 10px 14px' : '10px 14px 10px 38px') : '10px 14px',
      border: `1.5px solid ${t.border}`,
      borderRadius: 10,
      fontSize: 14,
      color: t.text,
      background: t.inputBg,
      outline: 'none',
      fontFamily: 'Heebo,sans-serif',
      direction: dir,
      textAlign: dir === 'rtl' ? 'right' : 'left',
      boxSizing: 'border-box',
    }),
    [icon, dir, t.border, t.text, t.inputBg],
  )

  const iconStyle: CSSProperties = {
    position: 'absolute',
    [dir === 'rtl' ? 'right' : 'left']: 11,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    color: t.textMuted,
    pointerEvents: 'none',
  }

  const dropdownStyle: CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: t.cardBg,
    border: `1.5px solid ${t.border}`,
    borderRadius: 10,
    boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
    maxHeight: 256,
    overflowY: 'auto',
    zIndex: 50,
    direction: dir,
  }

  const itemStyle = (active: boolean): CSSProperties => ({
    width: '100%',
    display: 'block',
    padding: '10px 14px',
    background: active ? t.inputBg : 'transparent',
    color: t.text,
    border: 'none',
    borderBottom: `1px solid ${t.border}`,
    fontSize: 14,
    fontFamily: 'Heebo,sans-serif',
    textAlign: dir === 'rtl' ? 'right' : 'left',
    cursor: 'pointer',
    direction: dir,
  })

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label ? <label style={labelStyle}>{label}</label> : null}
      <div style={{ position: 'relative' }}>
        {icon ? <span style={iconStyle}>{icon}</span> : null}
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true)
          }}
          placeholder={placeholder}
          disabled={disabled}
          dir={dir}
          autoComplete="off"
          style={inputStyle}
        />
        {open && suggestions.length > 0 ? (
          <div style={dropdownStyle} role="listbox">
            {suggestions.map((s, i) => {
              const active = i === highlight || i === hoverIndex
              return (
                <button
                  key={`${s.ResultLable}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(h => (h === i ? -1 : h))}
                  onMouseDown={e => {
                    // Prevent input blur before click fires
                    e.preventDefault()
                  }}
                  onClick={() => selectSuggestion(s)}
                  style={itemStyle(active)}
                >
                  {s.ResultLable}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default AddressInput
