import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Search, Phone, Mail, ArrowLeftRight, Loader2, X } from 'lucide-react'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { formatDate } from '@/lib/utils'
import { validatePersonalForm, type FormErrors } from '@/utils/israeliValidations'
import { toast, ConfirmDialog } from '@/components/ui'
import { useLeads, useCreateLead, useUpdateLead, useConvertLead } from '@/hooks/queries/useLeads'
import type { Lead, LeadStatus } from '@/types/database'

const sources = ['הכל', 'פייסבוק', 'אינסטגרם', 'אתר', 'וואטסאפ', 'הפניה', 'טלפון']
const statusOptions: LeadStatus[] = ['חדש', 'יצירת קשר', 'פגישה נקבעה', 'הפך ללקוח', 'נסגר']

const columns: { key: LeadStatus; label: string; color: string; bg: string }[] = [
  { key: 'חדש',         label: 'חדש',          color: '#7c3aed', bg: '#ede9fe' },
  { key: 'יצירת קשר',  label: 'יצירת קשר',   color: '#b45309', bg: '#fef3c7' },
  { key: 'פגישה נקבעה', label: 'פגישה נקבעה', color: '#9333ea', bg: '#f3e8ff' },
  { key: 'הפך ללקוח',  label: 'הפך ללקוח',   color: '#065f46', bg: '#d1fae5' },
]

const cardStyle = {
  background: '#ffffff',
  borderRadius: 16,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 4px 14px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e7e5e4',
  borderRadius: 10,
  fontSize: 14,
  color: '#1c1917',
  background: '#ffffff',
  outline: 'none',
  fontFamily: 'var(--font-heebo)',
}

type ColumnMeta = { key: LeadStatus; label: string; color: string; bg: string }

function KanbanColumn({ col, count, children }: { col: ColumnMeta; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-block text-[12px] font-bold px-3 py-1 rounded-full"
          style={{ background: col.bg, color: col.color }}
        >{col.label}</span>
        <span className="text-[12px] font-semibold" style={{ color: '#a8a29e' }}>{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className="space-y-3 transition-colors"
        style={{
          minHeight: 140,
          borderRadius: 14,
          background: isOver ? col.bg : 'transparent',
          outline: isOver ? `1.5px dashed ${col.color}` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function KanbanCard({ lead, col, index, onUpdateStatus, onConvert }: {
  lead: Lead
  col: ColumnMeta
  index: number
  onUpdateStatus: (id: string, status: LeadStatus) => void
  onConvert: (lead: Lead) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="group"
      style={{
        ...cardStyle,
        padding: '14px 16px',
        cursor: 'grab',
        touchAction: 'none',
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        boxShadow: isDragging ? '0 8px 28px rgba(28,25,23,0.18)' : cardStyle.boxShadow,
        animationName: isDragging ? undefined : 'fadeUp',
        animationDuration: '0.35s',
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-[13px] font-bold" style={{ color: '#1c1917' }}>{lead.name || '—'}</h3>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: idx < (lead.score ?? 0) ? col.color : 'transparent',
                border: `1.5px solid ${idx < (lead.score ?? 0) ? col.color : '#d6d3d1'}`,
              }}
            />
          ))}
        </div>
      </div>

      {lead.phone && (
        <div className="flex items-center gap-1.5 text-[12px] mb-1" style={{ color: '#57534e' }} dir="ltr">
          <Phone size={11} style={{ color: '#a8a29e' }} />
          {lead.phone}
        </div>
      )}
      {lead.email && (
        <div className="flex items-center gap-1.5 text-[12px] mb-1" style={{ color: '#57534e' }} dir="ltr">
          <Mail size={11} style={{ color: '#a8a29e' }} />
          {lead.email}
        </div>
      )}
      {lead.source && (
        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1" style={{ background: '#f5f4f2', color: '#a8a29e' }}>
          {lead.source}
        </span>
      )}

      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #f5f4f2' }}>
        <p className="text-[11px]" style={{ color: '#a8a29e' }}>{formatDate(lead.created_at)}</p>
        <div className="flex items-center gap-1">
          <select
            value={lead.status}
            onChange={e => onUpdateStatus(lead.id, e.target.value as LeadStatus)}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            className="text-[11px] font-semibold outline-none cursor-pointer"
            style={{ background: 'transparent', color: col.color, border: 'none', padding: 0 }}
          >
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {lead.status !== 'הפך ללקוח' && lead.status !== 'נסגר' && (
            <button
              onClick={() => onConvert(lead)}
              onPointerDown={e => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: '#d1fae5', color: '#065f46' }}
            >
              <ArrowLeftRight size={10} /> המר
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('הכל')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newLead, setNewLead] = useState({
    name: '', phone: '', email: '', source: 'פייסבוק', score: 5, notes: '',
  })
  const [leadErrors, setLeadErrors] = useState<FormErrors>({})
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null)

  const { data: leads = [], isLoading: loading } = useLeads({
    source: sourceFilter !== 'הכל' ? sourceFilter : undefined,
    search: search || undefined,
  })
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const convertLead = useConvertLead()

  const updateStatus = (id: string, status: LeadStatus) => {
    updateLead.mutate({ id, updates: { status } })
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const leadId = String(active.id)
    const newStatus = over.id as LeadStatus
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.status === newStatus) return
    // Dropping onto "converted" runs the real conversion flow, not just a status change.
    if (newStatus === 'הפך ללקוח') {
      setLeadToConvert(lead)
      return
    }
    updateStatus(leadId, newStatus)
  }

  const handleConvert = () => {
    if (!leadToConvert) return
    convertLead.mutate(leadToConvert.id, {
      onSuccess: (data) => {
        setLeadToConvert(null)
        toast.success('הליד הומר ללקוח בהצלחה')
        if (data) navigate(`/customers/${data.id}`)
      },
      onError: (err) => {
        setLeadToConvert(null)
        toast.error('שגיאה בהמרת ליד', err.message)
      },
    })
  }

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: FormErrors = {}
    if (newLead.name.trim().length < 2) errors.name = 'שם חייב להיות לפחות 2 תווים'
    Object.assign(errors, validatePersonalForm({ phone: newLead.phone, email: newLead.email }))
    setLeadErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error('יש שגיאות בטופס', 'אנא תקן את השדות המסומנים')
      return
    }
    createLead.mutate(
      {
        ...newLead,
        status: 'חדש' as LeadStatus,
        referral_partner_id: null,
      },
      {
        onSuccess: () => {
          setShowNewModal(false)
          setNewLead({ name: '', phone: '', email: '', source: 'פייסבוק', score: 5, notes: '' })
          setLeadErrors({})
          toast.success('הליד נוצר בהצלחה')
        },
        onError: (err) => toast.error('שגיאה ביצירת ליד', err.message),
      }
    )
  }

  const filtered = leads.filter(l => {
    const matchSearch = !search || (l.name ?? '').includes(search) || (l.phone ?? '').includes(search)
    const matchSource = sourceFilter === 'הכל' || l.source === sourceFilter
    return matchSearch && matchSource
  })

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>לידים</h1>
          <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>{leads.length} לידים</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.96] shrink-0"
          style={{ borderRadius: 12, background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
        >
          <UserPlus size={15} />
          ליד חדש
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e7e5e4', padding: 14 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute" style={{ right: 12, top: '50%', transform: 'translateY(-50%)', color: '#a8a29e' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש לפי שם או טלפון..."
              className="w-full pr-10 pl-4 py-2 outline-none text-[13px]"
              style={{ border: '1.5px solid #e7e5e4', borderRadius: 10, color: '#1c1917' }}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {sources.map(s => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className="px-3 py-1.5 text-[12px] font-semibold transition-all"
                style={{
                  borderRadius: 20,
                  background: sourceFilter === s ? '#059669' : '#f5f4f2',
                  color: sourceFilter === s ? '#fff' : '#57534e',
                }}
              >{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} style={{ color: '#059669' }} className="animate-spin" />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.map(col => {
              const colLeads = filtered.filter(l => l.status === col.key)
              return (
                <KanbanColumn key={col.key} col={col} count={colLeads.length}>
                  {colLeads.length === 0 ? (
                    <div
                      className="py-8 text-center text-[13px]"
                      style={{ ...cardStyle, border: '1.5px dashed #e7e5e4', background: '#faf9f7', color: '#a8a29e' }}
                    >
                      אין לידים
                    </div>
                  ) : colLeads.map((lead, i) => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      col={col}
                      index={i}
                      onUpdateStatus={updateStatus}
                      onConvert={setLeadToConvert}
                    />
                  ))}
                </KanbanColumn>
              )
            })}
          </div>
        </DndContext>
      )}

      {/* New Lead Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(28,25,23,0.5)' }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-md animate-fade-in"
            style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e7e5e4', padding: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-bold" style={{ color: '#1c1917' }}>ליד חדש</h2>
              <button onClick={() => setShowNewModal(false)} style={{ color: '#a8a29e' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3">
              {[
                { label: 'שם מלא *', field: 'name' as const, required: true },
                { label: 'טלפון', field: 'phone' as const, dir: 'ltr' },
                { label: 'אימייל', field: 'email' as const, dir: 'ltr', type: 'email' },
              ].map(({ label, field, required, dir, type }) => (
                <div key={field}>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>{label}</label>
                  <input
                    required={required}
                    type={type as 'text' | 'email' | undefined}
                    dir={dir as 'ltr' | undefined}
                    value={newLead[field]}
                    onChange={e => setNewLead(p => ({ ...p, [field]: e.target.value }))}
                    style={{ ...inputStyle, borderColor: leadErrors[field] ? '#dc2626' : '#e7e5e4' }}
                  />
                  {leadErrors[field] && (
                    <p className="text-[11px] mt-1" style={{ color: '#dc2626' }}>{leadErrors[field]}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>מקור</label>
                <select value={newLead.source} onChange={e => setNewLead(p => ({ ...p, source: e.target.value }))} style={{ ...inputStyle }}>
                  {sources.filter(s => s !== 'הכל').map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>ציון (1-10)</label>
                <input
                  type="number" min={1} max={10}
                  value={newLead.score}
                  onChange={e => setNewLead(p => ({ ...p, score: parseInt(e.target.value) || 5 }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>הערות</label>
                <textarea
                  value={newLead.notes}
                  onChange={e => setNewLead(p => ({ ...p, notes: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createLead.isPending}
                  className="flex-1 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ borderRadius: 12, background: '#059669' }}
                >
                  {createLead.isPending && <Loader2 size={15} className="animate-spin" />}
                  שמור
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 text-[13px] font-semibold transition-all hover:opacity-80"
                  style={{ borderRadius: 12, background: '#f5f4f2', color: '#57534e' }}
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!leadToConvert}
        variant="info"
        title="המרת ליד ללקוח"
        message={`להמיר את "${leadToConvert?.name || ''}" ללקוח? הליד יסומן כ"הפך ללקוח" וייווצר תיק לקוח חדש.`}
        confirmText="המר ללקוח"
        loading={convertLead.isPending}
        onConfirm={handleConvert}
        onCancel={() => setLeadToConvert(null)}
      />
    </div>
  )
}
