import { useState, useEffect } from 'react'
import { Modal, Input, Select, Button, toast } from '@/components/ui'
import { useCustomers } from '@/hooks/queries/useCustomers'
import { mortgageService } from '@/services/mortgageService'
import { formatCurrency } from '@/lib/utils'
import type { LoanTrackType, PropertyType } from '@/types/database'

export interface SaveMixTrack {
  type: LoanTrackType
  amount: number
  interest_rate: number
  period_months: number
  monthly_payment: number
}

export interface SaveMixData {
  property_price: number
  own_capital: number
  property_type: PropertyType
  loan_amount: number
  tracks: SaveMixTrack[]
}

interface SaveMixModalProps {
  open: boolean
  onClose: () => void
  mix: SaveMixData
  presetCustomerId?: string
  defaultName?: string
}

export function SaveMixModal({ open, onClose, mix, presetCustomerId, defaultName }: SaveMixModalProps) {
  const { data: customers, isLoading } = useCustomers()
  const [name, setName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(defaultName?.trim() || 'תמהיל')
      setCustomerId(presetCustomerId || '')
      setSaving(false)
    }
  }, [open, presetCustomerId, defaultName])

  const presetCustomer = presetCustomerId
    ? customers?.find((c) => c.id === presetCustomerId)
    : undefined

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('יש להזין שם לתמהיל')
      return
    }
    if (!customerId) {
      toast.error('יש לבחור לקוח')
      return
    }
    setSaving(true)
    const { error } = await mortgageService.createWithTracks(
      {
        customer_id: customerId,
        name: name.trim(),
        type: 'חדשה',
        property_price: mix.property_price,
        property_type: mix.property_type,
        own_capital: mix.own_capital,
        loan_amount: mix.loan_amount,
        status: 'טיוטה',
        compliance_status: null,
        notes: null,
      },
      mix.tracks.map((t) => ({
        type: t.type,
        amount: t.amount,
        interest_rate: t.interest_rate,
        period_months: t.period_months,
        monthly_payment: t.monthly_payment,
        is_existing: false,
        start_date: null,
        end_date: null,
      }))
    )
    setSaving(false)
    if (error) {
      toast.error('שגיאה בשמירת התמהיל', error.message)
      return
    }
    toast.success('התמהיל נשמר', `"${name.trim()}" נשמר בכרטיס הלקוח`)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="שמירת תמהיל ללקוח" size="md">
      <div className="space-y-4">
        <Input
          label="שם התמהיל"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="לדוגמה: תמהיל שמרני"
          maxLength={60}
        />

        {presetCustomerId ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">לקוח</label>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {presetCustomer
                ? `${presetCustomer.first_name} ${presetCustomer.last_name}`
                : 'טוען...'}
            </div>
          </div>
        ) : (
          <Select
            label="לקוח"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={isLoading}
          >
            <option value="">{isLoading ? 'טוען לקוחות...' : 'בחר לקוח...'}</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </Select>
        )}

        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 space-y-0.5">
          <div>סכום הלוואה: {formatCurrency(mix.loan_amount)}</div>
          <div>{mix.tracks.length} מסלולים</div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          ביטול
        </Button>
        <Button variant="primary" loading={saving} onClick={handleSave}>
          שמור תמהיל
        </Button>
      </div>
    </Modal>
  )
}
