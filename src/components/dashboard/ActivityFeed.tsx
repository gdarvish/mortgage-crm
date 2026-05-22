import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { UserPlus, ArrowLeftRight, FileText, Home, PenTool, DollarSign, Activity } from 'lucide-react'
import { db } from '@/lib/firebase'
import { fromDocs, awaitUserId } from '@/services/_firestoreHelpers'
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
        background: '#ffffff',
        borderRadius: 20,
        padding: '22px 26px',
        boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
      }}
    >
      <p className="text-[15px] font-bold mb-4 flex items-center gap-2" style={{ color: '#1c1917' }}>
        <Activity size={16} style={{ color: '#059669' }} />
        פעילות אחרונה
      </p>
      {isLoading ? (
        <p className="text-[13px] py-6 text-center" style={{ color: '#a8a29e' }}>טוען...</p>
      ) : events.length === 0 ? (
        <p className="text-[13px] py-6 text-center" style={{ color: '#a8a29e' }}>אין פעילות להצגה עדיין</p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const Icon = EVENT_ICON[e.event_type] ?? Activity
            return (
              <div key={e.id} className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 30, height: 30, borderRadius: 9, background: '#d1fae5' }}
                >
                  <Icon size={14} style={{ color: '#059669' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]" style={{ color: '#1c1917' }}>{e.description}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#a8a29e' }}>{timeAgo(e.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
