import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Loader2, Award, Download, History, Copy, ArrowDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast, ConfirmDialog } from '@/components/ui'
import { bankOfferService, offerTotals, latestOffersPerBank } from '@/services/bankOfferService'
import { calculateMonthlyPayment } from '@/utils/mortgageCalculations'
import { mortgageService } from '@/services/mortgageService'
import { exportBankComparisonPdf } from '@/utils/pdfExport'
import type { BankOffer, BankOfferTrack, LoanTrackType, MortgageWithTracks } from '@/types/database'

const TRACK_TYPES: LoanTrackType[] = ['פריים', 'קל"צ', 'קל"ב', 'משתנה_צמודה', 'משתנה_לא_צמודה', 'זכאות']

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#059669] focus:border-transparent outline-none text-sm'

interface Props {
  customerId: string
  mortgage: MortgageWithTracks
  customerName: string
  onChosen: () => void
}

const emptyTrack = (): BankOfferTrack => ({ type: 'קל"צ', amount: 0, interest_rate: 0, period_months: 300 })

export default function BankOffersSection({ customerId, mortgage, customerName, onChosen }: Props) {
  const [offers, setOffers] = useState<BankOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [choosing, setChoosing] = useState<BankOffer | null>(null)
  const [applying, setApplying] = useState(false)

  const [bankName, setBankName] = useState('')
  const [round, setRound] = useState(1)
  const [validUntil, setValidUntil] = useState('')
  const [tracks, setTracks] = useState<BankOfferTrack[]>([emptyTrack()])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await bankOfferService.getByMortgage(mortgage.id)
    setOffers(data ?? [])
    setLoading(false)
  }, [mortgage.id])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setBankName(''); setRound(1); setValidUntil(''); setTracks([emptyTrack()]); setShowForm(false)
  }

  const copyFromMix = () => {
    const mixTracks = mortgage.loan_tracks ?? []
    if (mixTracks.length === 0) {
      toast.error('אין מסלולים בתמהיל להעתקה')
      return
    }
    setTracks(mixTracks.map(t => ({
      type: t.type,
      amount: t.amount ?? 0,
      interest_rate: t.interest_rate ?? 0,
      period_months: t.period_months ?? 300,
    })))
  }

  const save = async () => {
    if (!bankName.trim()) { toast.error('חסר שם בנק'); return }
    const cleanTracks = tracks.filter(t => t.amount > 0)
    if (cleanTracks.length === 0) { toast.error('הוסף לפחות מסלול אחד עם סכום'); return }
    setSaving(true)
    const { error } = await bankOfferService.create({
      customer_id: customerId,
      mortgage_id: mortgage.id,
      bank_name: bankName.trim(),
      round,
      offer_date: new Date().toISOString().split('T')[0],
      valid_until: validUntil || null,
      tracks: cleanTracks,
      status: 'התקבלה',
      bank_response_id: null,
      notes: null,
    })
    setSaving(false)
    if (error) { toast.error('שגיאה בשמירה', error.message); return }
    toast.success('ההצעה נשמרה')
    resetForm()
    load()
  }

  const remove = async (id: string) => {
    await bankOfferService.delete(id)
    load()
  }

  const confirmChoose = async () => {
    if (!choosing) return
    setApplying(true)
    // Mark this offer chosen, all sibling offers for the mortgage rejected.
    await bankOfferService.update(choosing.id, { status: 'נבחרה' })
    await Promise.all(
      offers
        .filter(o => o.id !== choosing.id && o.status !== 'נדחתה')
        .map(o => bankOfferService.update(o.id, { status: 'נדחתה' }))
    )
    // The offer becomes a version of its own rather than overwriting the mix:
    // what the advisor asked for and what the bank came back with are both
    // part of the negotiation, and the client should be able to see each.
    const tracks = choosing.tracks.map(t => ({
      type: t.type,
      amount: t.amount,
      interest_rate: t.interest_rate,
      period_months: t.period_months,
      monthly_payment: Math.round(
        calculateMonthlyPayment(t.amount, t.interest_rate, t.period_months),
      ),
      is_existing: false,
      start_date: null,
      end_date: null,
    }))
    const loanAmount = choosing.tracks.reduce((sum, t) => sum + t.amount, 0)
    const { monthly, total } = offerTotals(choosing)

    const { error } = await mortgageService.createVersion({
      customerId,
      parent: mortgage,
      label: `הצעת ${choosing.bank_name}${choosing.round > 1 ? ` — סבב ${choosing.round}` : ''}`,
      source: 'bank_offer',
      propertyPrice: mortgage.property_price,
      propertyType: mortgage.property_type,
      ownCapital: mortgage.own_capital,
      loanAmount,
      snapshot: {
        dti: 0,
        ltv: mortgage.property_price ? Math.round((loanAmount / mortgage.property_price) * 1000) / 10 : 0,
        monthly_payment: monthly,
        total_cost: total,
        compliance: null,
        bank_name: choosing.bank_name,
      },
      tracks,
    })

    setApplying(false)
    setChoosing(null)
    if (error) {
      toast.error('ההצעה נבחרה אך יצירת הגרסה נכשלה', error.message)
    } else {
      toast.success('ההצעה נבחרה ונוצרה גרסת תמהיל חדשה')
    }
    load()
    onChosen()
  }

  const exportPdf = async () => {
    const latest = latestOffersPerBank(offers)
    if (latest.length === 0) { toast.error('אין הצעות לייצוא'); return }
    try {
      await exportBankComparisonPdf({
        customerName,
        offers: latest.map(o => {
          const { monthly, total } = offerTotals(o)
          return {
            bankName: o.bank_name,
            round: o.round,
            tracks: o.tracks.map(t => ({
              type: t.type, amount: t.amount, interestRate: t.interest_rate, periodMonths: t.period_months,
            })),
            monthly, total,
          }
        }),
      })
    } catch (e) {
      toast.error('שגיאה בייצוא', e instanceof Error ? e.message : undefined)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 size={24} className="text-[#059669] animate-spin" /></div>
  }

  const latest = latestOffersPerBank(offers)
  const trackTypesInComparison = Array.from(new Set(latest.flatMap(o => o.tracks.map(t => t.type))))
  const totalsByBank = new Map(latest.map(o => [o.id, offerTotals(o)]))
  const bestMonthly = latest.length ? Math.min(...latest.map(o => totalsByBank.get(o.id)!.monthly)) : 0
  const bestTotal = latest.length ? Math.min(...latest.map(o => totalsByBank.get(o.id)!.total)) : 0

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-medium text-gray-900">השוואת הצעות בנקים</h4>
        <div className="flex items-center gap-2">
          {offers.length > 0 && (
            <>
              <button onClick={() => setShowHistory(v => !v)}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <History size={15} /> {showHistory ? 'הסתר סבבים' : 'הצג היסטוריית סבבים'}
              </button>
              <button onClick={exportPdf}
                className="inline-flex items-center gap-1.5 text-sm text-[#059669] hover:text-[#047857] transition-colors">
                <Download size={15} /> ייצא השוואה
              </button>
            </>
          )}
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 bg-[#059669] text-white px-3 py-1.5 rounded-lg text-sm hover:bg-[#047857] transition-colors">
              <Plus size={15} /> הצעה
            </button>
          )}
        </div>
      </div>

      {/* Enter offer form */}
      {showForm && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">בנק</label>
              <input className={inputClass} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="שם הבנק" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">סבב</label>
              <input className={inputClass} type="number" min={1} dir="ltr" value={round} onChange={e => setRound(Math.max(1, +e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">תוקף ההצעה</label>
              <input className={inputClass} type="date" dir="ltr" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">מסלולים</span>
            <button onClick={copyFromMix} className="inline-flex items-center gap-1 text-xs text-[#059669] hover:underline">
              <Copy size={13} /> העתק מהתמהיל
            </button>
          </div>
          {tracks.map((t, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select className={`${inputClass} col-span-4 bg-white`} value={t.type}
                onChange={e => setTracks(tracks.map((x, j) => j === i ? { ...x, type: e.target.value as LoanTrackType } : x))}>
                {TRACK_TYPES.map(tt => <option key={tt} value={tt}>{tt}</option>)}
              </select>
              <input className={`${inputClass} col-span-3`} type="number" dir="ltr" placeholder="סכום" value={t.amount || ''}
                onChange={e => setTracks(tracks.map((x, j) => j === i ? { ...x, amount: +e.target.value } : x))} />
              <input className={`${inputClass} col-span-2`} type="number" step="0.01" dir="ltr" placeholder="ריבית" value={t.interest_rate || ''}
                onChange={e => setTracks(tracks.map((x, j) => j === i ? { ...x, interest_rate: +e.target.value } : x))} />
              <input className={`${inputClass} col-span-2`} type="number" dir="ltr" placeholder="חוד'" value={t.period_months || ''}
                onChange={e => setTracks(tracks.map((x, j) => j === i ? { ...x, period_months: +e.target.value } : x))} />
              <button onClick={() => setTracks(tracks.filter((_, j) => j !== i))} className="col-span-1 text-gray-300 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button onClick={() => setTracks([...tracks, emptyTrack()])} className="text-xs text-[#059669] hover:underline">+ הוסף מסלול</button>

          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">ביטול</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 bg-[#059669] text-white px-4 py-2 rounded-lg hover:bg-[#047857] transition-colors text-sm disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} שמור הצעה
            </button>
          </div>
        </div>
      )}

      {offers.length === 0 && !showForm && (
        <p className="text-center text-sm text-gray-400 py-4">לא הוזנו הצעות בנקים</p>
      )}

      {/* Comparison table — latest round per bank */}
      {latest.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-right p-2 font-medium text-gray-600 border-b border-gray-100">מסלול</th>
                {latest.map(o => (
                  <th key={o.id} className="p-2 font-medium text-gray-700 border-b border-gray-100 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{o.bank_name}</span>
                      <span className="text-[10px] text-gray-400">סבב {o.round}</span>
                      {o.status === 'נבחרה' && <span className="text-[10px] text-green-600 font-semibold">✓ נבחרה</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trackTypesInComparison.map(type => (
                <tr key={type}>
                  <td className="p-2 text-gray-900 border-b border-gray-50">{type}</td>
                  {latest.map(o => {
                    const t = o.tracks.find(tr => tr.type === type)
                    return <td key={o.id} className="p-2 text-center text-gray-700 border-b border-gray-50" dir="ltr">{t ? `${t.interest_rate.toFixed(2)}%` : '—'}</td>
                  })}
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="p-2 font-bold text-gray-900">החזר חודשי</td>
                {latest.map(o => {
                  const m = totalsByBank.get(o.id)!.monthly
                  return <td key={o.id} className={`p-2 text-center font-bold ${m === bestMonthly ? 'bg-emerald-100 text-[#059669]' : 'text-gray-900'}`}>{formatCurrency(m)}</td>
                })}
              </tr>
              <tr className="bg-gray-50">
                <td className="p-2 font-bold text-gray-900">עלות כוללת</td>
                {latest.map(o => {
                  const tot = totalsByBank.get(o.id)!.total
                  return <td key={o.id} className={`p-2 text-center font-bold ${tot === bestTotal ? 'bg-emerald-100 text-[#059669]' : 'text-gray-900'}`}>{formatCurrency(tot)}</td>
                })}
              </tr>
              <tr>
                <td className="p-2" />
                {latest.map(o => (
                  <td key={o.id} className="p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {o.status !== 'נבחרה' && (
                        <button onClick={() => setChoosing(o)}
                          className="inline-flex items-center gap-1 text-xs bg-[#059669] text-white px-2 py-1 rounded-lg hover:bg-[#047857] transition-colors">
                          <Award size={12} /> בחר
                        </button>
                      )}
                      <button onClick={() => remove(o.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Rounds history */}
      {showHistory && offers.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <h5 className="text-xs font-semibold text-gray-500 mb-2">היסטוריית סבבים</h5>
          <div className="space-y-2">
            {Array.from(new Set(offers.map(o => o.bank_name))).map(bank => {
              const bankOffers = offers.filter(o => o.bank_name === bank).sort((a, b) => a.round - b.round)
              return (
                <div key={bank} className="text-sm">
                  <span className="font-medium text-gray-700">{bank}:</span>{' '}
                  {bankOffers.map((o, idx) => {
                    const prev = idx > 0 ? bankOffers[idx - 1] : null
                    const m = offerTotals(o).monthly
                    const improved = prev && m < offerTotals(prev).monthly
                    return (
                      <span key={o.id} className="inline-flex items-center gap-1 mr-2">
                        <span className="text-gray-500">סבב {o.round}: {formatCurrency(m)}/חודש</span>
                        {improved && <ArrowDown size={12} className="text-green-600" />}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!choosing}
        title="בחירת הצעה"
        message={choosing ? `לבחור את ההצעה של ${choosing.bank_name} (סבב ${choosing.round})? תיווצר גרסת תמהיל חדשה מההצעה, הגרסה הנוכחית תישמר כפי שהיא, ושאר ההצעות יידחו.` : ''}
        confirmText="בחר ועדכן תמהיל"
        loading={applying}
        onConfirm={confirmChoose}
        onCancel={() => setChoosing(null)}
      />
    </div>
  )
}
