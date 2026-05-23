import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Save, X, User, Home, Search } from 'lucide-react'
import { useTheme } from '@/theme/ThemeContext'
import { useCustomers } from '@/hooks/queries/useCustomers'
import { AddressInput } from '@/components/AddressInput'
import type { Customer } from '@/types/database'

export interface SaveMortgageDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (v: {
    customerId: string
    name: string
    propertyAddress: string
    propertyX: number | null
    propertyY: number | null
  }) => Promise<void> | void
  defaultCustomerId?: string
  defaultName?: string
  saving?: boolean
  title?: string
}

export function SaveMortgageDialog({
  open,
  onClose,
  onSubmit,
  defaultCustomerId,
  defaultName,
  saving = false,
  title = 'שמור כתיק לקוח',
}: SaveMortgageDialogProps) {
  const t = useTheme()
  const { data: customers = [] } = useCustomers()

  const [customerId, setCustomerId] = useState<string>(defaultCustomerId ?? '')
  const [customerQuery, setCustomerQuery] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [name, setName] = useState<string>(defaultName ?? '')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [propertyX, setPropertyX] = useState<number | null>(null)
  const [propertyY, setPropertyY] = useState<number | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCustomerId(defaultCustomerId ?? '')
      setName(defaultName ?? '')
      setPropertyAddress('')
      setPropertyX(null)
      setPropertyY(null)
      setCustomerQuery('')
      setPickerOpen(false)
    }
  }, [open, defaultCustomerId, defaultName])

  // Find the selected customer
  const selectedCustomer: Customer | null = useMemo(() => {
    if (!customerId) return null
    return customers.find(c => c.id === customerId) ?? null
  }, [customerId, customers])

  const lockedCustomer = Boolean(defaultCustomerId)

  // Close picker on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!pickerRef.current) return
      if (!pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) {
      document.addEventListener('mousedown', handle)
      return () => document.removeEventListener('mousedown', handle)
    }
  }, [pickerOpen])

  // Escape closes
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return customers.slice(0, 20)
    return customers
      .filter(c => {
        const full = `${c.first_name} ${c.last_name}`.toLowerCase()
        const phone = (c.phone ?? '').toLowerCase()
        return full.includes(q) || phone.includes(q)
      })
      .slice(0, 20)
  }, [customerQuery, customers])

  const trimmedName = name.trim()
  const canSubmit = !!customerId && trimmedName.length >= 1 && !saving

  const handleSubmit = async () => {
    if (!canSubmit) return
    await onSubmit({
      customerId,
      name: trimmedName,
      propertyAddress: propertyAddress.trim(),
      propertyX,
      propertyY,
    })
  }

  if (!open) return null

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: t.textMuted,
    marginBottom: 6,
    letterSpacing: '0.03em',
  }
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: `1.5px solid ${t.border}`,
    borderRadius: 10,
    fontSize: 14,
    color: t.text,
    background: t.inputBg,
    outline: 'none',
    fontFamily: 'Heebo,sans-serif',
    direction: 'rtl',
    textAlign: 'right',
    boxSizing: 'border-box',
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28,25,23,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 16,
      }}
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        dir="rtl"
        style={{
          background: t.cardBg,
          borderRadius: 20,
          border: `1px solid ${t.border}`,
          padding: 28,
          width: '100%',
          maxWidth: 480,
          boxShadow: t.shadowHover,
          fontFamily: 'Heebo,sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{title}</h2>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ background: 'none', border: 'none', cursor: saving ? 'default' : 'pointer', color: t.textMuted, padding: 4 }}
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Customer picker */}
          <div ref={pickerRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>לקוח</label>
            {lockedCustomer ? (
              <div
                style={{
                  ...inputStyle,
                  background: t.bg,
                  color: t.textSub,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <User size={14} color={t.textMuted} />
                <span>
                  {selectedCustomer
                    ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                    : 'לקוח נטען...'}
                </span>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      right: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: t.textMuted,
                      pointerEvents: 'none',
                      display: 'flex',
                    }}
                  >
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={
                      selectedCustomer && !pickerOpen
                        ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                        : customerQuery
                    }
                    onChange={e => {
                      setCustomerQuery(e.target.value)
                      setCustomerId('')
                      setPickerOpen(true)
                    }}
                    onFocus={() => setPickerOpen(true)}
                    placeholder="חפש לפי שם או טלפון..."
                    style={{ ...inputStyle, padding: '10px 34px 10px 14px' }}
                  />
                </div>
                {pickerOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: t.cardBg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 10,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                      maxHeight: 240,
                      overflowY: 'auto',
                      zIndex: 70,
                    }}
                  >
                    {filteredCustomers.length === 0 ? (
                      <div style={{ padding: '12px 14px', fontSize: 13, color: t.textMuted }}>
                        לא נמצאו לקוחות
                      </div>
                    ) : (
                      filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setCustomerId(c.id)
                            setCustomerQuery('')
                            setPickerOpen(false)
                          }}
                          style={{
                            width: '100%',
                            display: 'block',
                            padding: '10px 14px',
                            background: 'transparent',
                            color: t.text,
                            border: 'none',
                            borderBottom: `1px solid ${t.border}`,
                            fontSize: 14,
                            fontFamily: 'Heebo,sans-serif',
                            textAlign: 'right',
                            cursor: 'pointer',
                            direction: 'rtl',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</span>
                          {c.phone ? (
                            <span style={{ marginRight: 8, fontSize: 12, color: t.textMuted }} dir="ltr">
                              {c.phone}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>שם התיק</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="לדוגמה: דירת מגורים חדשה"
              style={inputStyle}
            />
          </div>

          {/* Address */}
          <div>
            <AddressInput
              label="כתובת הנכס"
              value={propertyAddress}
              onChange={v => {
                setPropertyAddress(v)
                // If user edits manually, clear x/y until a new suggestion is picked
                if (propertyX !== null || propertyY !== null) {
                  setPropertyX(null)
                  setPropertyY(null)
                }
              }}
              onSelect={s => {
                setPropertyAddress(s.text)
                setPropertyX(s.x)
                setPropertyY(s.y)
              }}
              placeholder="התחל להקליד כתובת..."
              icon={<Home size={14} />}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="crm-btn-primary"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 0',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                borderRadius: 12,
                border: 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                background: t.primary,
                fontFamily: 'Heebo,sans-serif',
                opacity: canSubmit ? 1 : 0.5,
                boxShadow: `0 4px 14px ${t.primary}45`,
              }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="crm-btn"
              style={{
                flex: 1,
                padding: '11px 0',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                cursor: saving ? 'not-allowed' : 'pointer',
                background: t.bg,
                color: t.textSub,
                fontFamily: 'Heebo,sans-serif',
                opacity: saving ? 0.5 : 1,
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default SaveMortgageDialog
