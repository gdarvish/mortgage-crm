import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, User, ChevronLeft } from 'lucide-react'
import { meetingService, type MeetingWithCustomer } from '@/services/meetingService'

const cardStyle = {
  background: 'var(--color-card)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-border)',
}

export default function TodayMeetingsWidget() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<MeetingWithCustomer[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    meetingService.getToday().then(({ data }) => {
      setMeetings((data ?? []).filter(m => m.status === 'מתוכננת'))
      setLoaded(true)
    })
  }, [])

  if (!loaded || meetings.length === 0) return null

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
        <h2 className="text-[15px] font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <CalendarDays size={17} style={{ color: 'var(--color-primary)' }} /> הפגישות של היום ({meetings.length})
        </h2>
        <button onClick={() => navigate('/meetings')} className="text-[12px] text-[var(--color-primary)] hover:underline inline-flex items-center gap-1">
          לכל הפגישות <ChevronLeft size={13} />
        </button>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--color-border-light)' }}>
        {meetings.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-6 py-3">
            <span className="text-sm font-bold text-[var(--color-primary)] tabular-nums shrink-0" dir="ltr">
              {new Date(m.starts_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">{m.title}</p>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] flex-wrap">
                {m.customer && <span className="inline-flex items-center gap-1"><User size={11} /> {m.customer.first_name} {m.customer.last_name}</span>}
                {m.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {m.location}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
