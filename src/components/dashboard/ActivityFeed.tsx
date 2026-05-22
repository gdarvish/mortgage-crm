import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { UserPlus, ArrowLeftRight, FileText, Home, PenTool, DollarSign, Activity } from 'lucide-react'
import { db } from '@/lib/firebase'
import { fromDocs, awaitUserId } from '@/services/_firestoreHelpers'
import { useTheme } from '@/theme/ThemeContext'
import type { ActivityEvent, ActivityEventType } from '@/types/database'

const EVENT_ICON: Record<ActivityEventType, typeof Activity> = {
  customer_created: UserPlus,
  status_changed: ArrowLeftRight,
  document_uploaded: FileText,
  mortgage_created: Home,
  signature_received: PenTool,
  commission_paid: DollarSign,
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'הרגע'
  if (minutes < 60) return `לפני ${minutes} דקות`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `לפני ${hours} שעות`
  const days = Math.floor(hours / 24)
  if (days < 30) return `לפני ${days} ימים`
  return new Date(iso).toLocaleDateString('he-IL')
}

export function ActivityFeed() {
  const t = useTheme()
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(
          collection(db, 'activity'),
          where('user_id', '==', uid),
          orderBy('created_at', 'desc'),
          limit(15)
        )
      )
      return fromDocs<ActivityEvent>(snap.docs)
    },
  })

  return (
    <div
      style={{
        background: t.cardBg,
        borderRadius: 20,
        padding: '22px 26px',
        boxShadow: t.shadow,
        border: `1px solid ${t.border}`,
        animation: 'fadeUp 0.5s ease 0.68s backwards',
      }}
    >
      <p className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16 }}>
        <Activity size={16} style={{ color: t.primary }} />
        פעילות אחרונה
      </p>
      {isLoading ? (
        <p className="text-[13px] py-6 text-center" style={{ color: t.textMuted }}>טוען...</p>
      ) : events.length === 0 ? (
        <p className="text-[13px] py-6 text-center" style={{ color: t.textMuted }}>אין פעילות להצגה עדיין</p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const Icon = EVENT_ICON[e.event_type] ?? Activity
            return (
              <div key={e.id} className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 30, height: 30, borderRadius: 9, background: t.primary + '18' }}
                >
                  <Icon size={14} style={{ color: t.primary }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, color: t.text }}>{e.description}</p>
                  <p style={{ fontSize: 11, marginTop: 2, color: t.textMuted }}>{timeAgo(e.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
