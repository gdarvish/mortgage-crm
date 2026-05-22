import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Mail, UserPlus, Loader2 } from 'lucide-react'
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
import { useTheme } from '@/theme/ThemeContext'
import { useLeads, useCreateLead, useUpdateLead, useConvertLead } from '@/hooks/queries/useLeads'
import type { Lead, LeadStatus } from '@/types/database'

const sources = ['פייסבוק', 'אינסטגרם', 'הפניה', 'אתר', 'וואטסאפ']
const modalSources = ['פייסבוק', 'אינסטגרם', 'הפניה', 'אתר', 'וואטסאפ', 'טלפון']
const kanbanCols: LeadStatus[] = ['חדש', 'יצירת קשר', 'פגישה נקבעה', 'הפך ללקוח']

// Reproduced from design crm-data.js leadStatusColors helper.
function leadStatusColors(status: string): { bg: string; text: string } {
  return (
    {
      'חדש': { bg: '#dbeafe', text: '#1d4ed8' },
      'יצירת קשר': { bg: '#fef3c7', text: '#b45309' },
      'פגישה נקבעה': { bg: '#f3e8ff', text: '#7e22ce' },
      'הפך ללקוח': { bg: '#d1fae5', text: '#065f46' },
      'נסגר': { bg: '#f1f5f9', text: '#64748b' },
    }[status] || { bg: '#f1f5f9', text: '#64748b' }
  )
}

type ThemeShape = ReturnType<typeof useTheme>

function KanbanColumn({
  t,
  col,
  count,
  colIdx,
  children,
}: {
  t: ThemeShape
  col: LeadStatus
  count: number
  colIdx: number
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col })
  const lsc = leadStatusColors(col)
  return (
    <div style={{ animation: `fadeUp 0.45s ease ${colIdx * 0.07 + 0.15}s backwards` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{col}</span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 20,
            background: lsc.bg,
            color: lsc.text,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minHeight: 80,
          borderRadius: 14,
          background: isOver ? lsc.bg : 'transparent',
          outline: isOver ? `1.5px dashed ${lsc.text}` : 'none',
          transition: 'background 0.15s ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function KanbanCard({
  t,
  lead,
  col,
  colIdx,
  index,
  onConvert,
}: {
  t: ThemeShape
  lead: Lead
  col: LeadStatus
  colIdx: number
  index: number
  onConvert: (lead: Lead) => void
}) {
  const [hov, setHov] = useState(false)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: t.cardBg,
        borderRadius: 14,
        padding: '16px 18px',
        boxShadow: isDragging ? '0 8px 28px rgba(28,25,23,0.18)' : hov ? t.shadowHover : t.shadow,
        border: `1px solid ${hov ? t.primary + '30' : t.border}`,
        cursor: 'grab',
        touchAction: 'none',
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : hov
            ? 'translateY(-3px)'
            : 'translateY(0)',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        transition:
          'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, border-color 0.15s ease',
        animation: isDragging
          ? undefined
          : `fadeUp 0.4s ease ${index * 0.07 + colIdx * 0.07 + 0.2}s backwards`,
      }}
    >
      {/* Score dots */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {Array.from({ length: 10 }).map((_, si) => (
          <div
            key={si}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: si < (lead.score ?? 0) ? t.accent : t.border,
              transform: hov && si < (lead.score ?? 0) ? 'scale(1.3)' : 'scale(1)',
              transition: `transform 0.18s ease ${si * 0.02}s`,
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: t.primary + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: t.primary,
            flexShrink: 0,
            transition: 'transform 0.18s ease',
            transform: hov ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {(lead.name ?? '—').charAt(0)}
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{lead.name || '—'}</p>
          {lead.phone && (
            <p style={{ fontSize: 11, color: t.textMuted }} dir="ltr">
              {lead.phone}
            </p>
          )}
        </div>
      </div>

      {lead.notes && (
        <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
          {lead.notes}
        </p>
      )}
      {lead.email && (
        <p
          style={{
            fontSize: 11,
            color: t.textMuted,
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
          dir="ltr"
        >
          <Mail size={11} color={t.textMuted} />
          {lead.email}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>
          {[lead.source, formatDate(lead.created_at)].filter(Boolean).join(' · ')}
        </span>
        {col !== 'הפך ללקוח' && (
          <button
            className="crm-btn"
            onClick={() => onConvert(lead)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              background: t.successBg,
              color: t.success,
              border: 'none',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Heebo,sans-serif',
              opacity: hov ? 1 : 0,
              transform: hov ? 'translateX(0)' : 'translateX(6px)',
              transition: 'opacity 0.18s ease, transform 0.18s ease',
            }}
          >
            המר →
          </button>
        )}
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const t = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'פייסבוק',
    score: 5,
    notes: '',
  })
  const [leadErrors, setLeadErrors] = useState<FormErrors>({})
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null)

  const { data: leads = [], isLoading: loading } = useLeads({
    source: sourceFilter ?? undefined,
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
    const lead = leads.find((l) => l.id === leadId)
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
          setShowModal(false)
          setNewLead({ name: '', phone: '', email: '', source: 'פייסבוק', score: 5, notes: '' })
          setLeadErrors({})
          toast.success('הליד נוצר בהצלחה')
        },
        onError: (err) => toast.error('שגיאה ביצירת ליד', err.message),
      }
    )
  }

  const filtered = leads.filter((l) => {
    const matchSearch =
      !search || (l.name ?? '').includes(search) || (l.phone ?? '').includes(search)
    const matchSource = !sourceFilter || l.source === sourceFilter
    return matchSearch && matchSource
  })

  const inputSt: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: `1.5px solid ${t.border}`,
    borderRadius: 9,
    fontSize: 14,
    color: t.text,
    background: t.inputBg,
    outline: 'none',
    fontFamily: 'Heebo,sans-serif',
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 28,
            animation: 'fadeUp 0.4s ease backwards',
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>לידים</h1>
            <p style={{ fontSize: 13, color: t.textMuted }}>{leads.length} לידים פעילים</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="crm-btn-primary"
            style={{
              background: t.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Heebo,sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: `0 4px 14px ${t.primary}45`,
              flexShrink: 0,
            }}
          >
            <UserPlus size={15} color="#fff" strokeWidth={2.5} />
            ליד חדש
          </button>
        </div>

        {/* Search + source filters */}
        <div
          style={{
            background: t.cardBg,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            boxShadow: t.shadow,
            padding: '14px 18px',
            marginBottom: 24,
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
            animation: 'fadeUp 0.4s ease 0.1s backwards',
          }}
        >
          <div style={{ position: 'relative', flex: 1, maxWidth: 280, minWidth: 200 }}>
            <span
              style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }}
            >
              <Search size={15} color={t.textMuted} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש ליד..."
              style={{
                width: '100%',
                paddingRight: 38,
                paddingLeft: 14,
                height: 38,
                borderRadius: 9,
                border: `1px solid ${t.border}`,
                background: t.inputBg,
                color: t.text,
                fontSize: 14,
                outline: 'none',
                fontFamily: 'Heebo,sans-serif',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = t.primary
                e.target.style.boxShadow = `0 0 0 3px ${t.primary}20`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = t.border
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sources.map((src, i) => {
              const active = sourceFilter === src
              return (
                <button
                  key={src}
                  className="crm-btn"
                  onClick={() => setSourceFilter(active ? null : src)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: `1px solid ${active ? t.primary : t.border}`,
                    background: active ? t.primary : t.bg,
                    color: active ? '#fff' : t.textSub,
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    fontFamily: 'Heebo,sans-serif',
                    transition: 'all 0.15s ease',
                    animation: `fadeIn 0.4s ease ${i * 0.05 + 0.2}s backwards`,
                  }}
                >
                  {src}
                </button>
              )
            })}
          </div>
        </div>

        {/* Kanban */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={28} color={t.primary} className="animate-spin" />
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {kanbanCols.map((col, colIdx) => {
                const colLeads = filtered.filter((l) => l.status === col)
                return (
                  <KanbanColumn key={col} t={t} col={col} count={colLeads.length} colIdx={colIdx}>
                    {colLeads.length === 0 ? (
                      <div
                        style={{
                          border: `2px dashed ${t.border}`,
                          borderRadius: 14,
                          padding: '32px 14px',
                          textAlign: 'center',
                          color: t.textMuted,
                          fontSize: 13,
                        }}
                      >
                        אין לידים
                      </div>
                    ) : (
                      colLeads.map((lead, i) => (
                        <KanbanCard
                          key={lead.id}
                          t={t}
                          lead={lead}
                          col={col}
                          colIdx={colIdx}
                          index={i}
                          onConvert={setLeadToConvert}
                        />
                      ))
                    )}
                  </KanbanColumn>
                )
              })}
            </div>
          </DndContext>
        )}
      </div>

      {/* New Lead Modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(28,25,23,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: t.cardBg,
              borderRadius: 20,
              padding: 28,
              width: '100%',
              maxWidth: 440,
              boxShadow: t.shadowHover,
              animation: 'scaleIn 0.25s ease',
              border: `1px solid ${t.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 800, color: t.text }}>ליד חדש</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} color={t.textMuted} />
              </button>
            </div>
            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(
                [
                  ['שם מלא *', 'name', 'text', 'rtl'],
                  ['טלפון', 'phone', 'tel', 'ltr'],
                  ['אימייל', 'email', 'email', 'ltr'],
                ] as const
              ).map(([lbl, fld, type, dir]) => (
                <div key={fld}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.textMuted,
                      marginBottom: 5,
                    }}
                  >
                    {lbl}
                  </label>
                  <input
                    type={type}
                    dir={dir}
                    value={newLead[fld]}
                    onChange={(e) => setNewLead((p) => ({ ...p, [fld]: e.target.value }))}
                    style={{ ...inputSt, borderColor: leadErrors[fld] ? t.danger : t.border }}
                  />
                  {leadErrors[fld] && (
                    <p style={{ fontSize: 11, marginTop: 4, color: t.danger }}>{leadErrors[fld]}</p>
                  )}
                </div>
              ))}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.textMuted,
                    marginBottom: 5,
                  }}
                >
                  מקור
                </label>
                <select
                  value={newLead.source}
                  onChange={(e) => setNewLead((p) => ({ ...p, source: e.target.value }))}
                  style={inputSt}
                >
                  {modalSources.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.textMuted,
                    marginBottom: 5,
                  }}
                >
                  ציון (1-10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  dir="ltr"
                  value={newLead.score}
                  onChange={(e) =>
                    setNewLead((p) => ({ ...p, score: parseInt(e.target.value) || 5 }))
                  }
                  style={inputSt}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.textMuted,
                    marginBottom: 5,
                  }}
                >
                  הערות
                </label>
                <textarea
                  value={newLead.notes}
                  onChange={(e) => setNewLead((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  style={{ ...inputSt, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={createLead.isPending}
                  className="crm-btn-primary"
                  style={{
                    flex: 1,
                    background: t.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '11px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Heebo,sans-serif',
                    boxShadow: `0 4px 14px ${t.primary}45`,
                    opacity: createLead.isPending ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {createLead.isPending && <Loader2 size={15} className="animate-spin" />}
                  שמור
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="crm-btn"
                  style={{
                    flex: 1,
                    background: t.bg,
                    color: t.textSub,
                    border: `1px solid ${t.border}`,
                    borderRadius: 12,
                    padding: '11px 0',
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'Heebo,sans-serif',
                  }}
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Lead confirm dialog */}
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
