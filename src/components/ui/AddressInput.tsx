import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AddressSuggestion {
  text: string
  /** Israeli Transverse Mercator coordinates, as returned by GovMap. */
  x: number
  y: number
}

export interface AddressInputProps {
  value: string
  onChange: (text: string) => void
  onSelect?: (suggestion: AddressSuggestion) => void
  placeholder?: string
  id?: string
  disabled?: boolean
  className?: string
  /** Rendered inside the field, at the start edge. */
  icon?: ReactNode
}

interface GovMapAddress {
  ResultLable: string
  X: number
  Y: number
}

const GOVMAP_URL = 'https://es.govmap.gov.il/TldSearch/api/AutoComplete'
const DEBOUNCE_MS = 250
const MIN_CHARS = 2
const MAX_RESULTS = 8

/**
 * Address field with autocomplete from GovMap, the national address index.
 *
 * The lookup is best-effort: the service is public, unauthenticated and
 * cross-origin, so a blocked or failing request must leave a plain text
 * field behind rather than an error. Nothing is sent until two characters
 * are typed, and the request is debounced and aborted on every keystroke.
 */
export function AddressInput({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  disabled,
  className,
  icon,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<GovMapAddress[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Picking a suggestion writes into `value`; without this the write would
  // immediately re-open the dropdown with the text just chosen.
  const skipNextFetch = useRef(false)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false
      return
    }
    abortRef.current?.abort()

    const trimmed = value.trim()
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([])
      setOpen(false)
      setHighlight(-1)
      return
    }

    const timer = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      fetch(GOVMAP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: trimmed, LstResult: null }),
        signal: controller.signal,
      })
        .then(r => (r.ok ? r.json() : null))
        .then((data: { res?: { ADDRESS?: GovMapAddress[] } } | null) => {
          const addresses = (data?.res?.ADDRESS ?? []).slice(0, MAX_RESULTS)
          setSuggestions(addresses)
          setHighlight(-1)
          setOpen(addresses.length > 0)
        })
        .catch(() => {
          // Aborted, offline, or blocked by CORS — fall back to free text.
          setSuggestions([])
          setOpen(false)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [value])

  useEffect(() => () => abortRef.current?.abort(), [])

  const pick = useCallback((s: GovMapAddress) => {
    skipNextFetch.current = true
    onChange(s.ResultLable)
    onSelect?.({ text: s.ResultLable, x: s.X, y: s.Y })
    setOpen(false)
    setHighlight(-1)
    setSuggestions([])
  }, [onChange, onSelect])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(suggestions[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {icon && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(className, icon && 'pr-9')}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg py-1"
          style={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card-hover)',
          }}
        >
          {suggestions.map((s, i) => (
            <li key={`${s.ResultLable}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                // Mousedown would blur the input and close the list first.
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(s)}
                className="block w-full px-3.5 py-2.5 text-right text-[14px]"
                style={{
                  background: i === highlight ? 'var(--color-bg)' : 'transparent',
                  color: 'var(--color-text)',
                }}
              >
                {s.ResultLable}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
