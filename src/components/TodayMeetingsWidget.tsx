import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, User, ChevronLeft } from 'lucide-react'
import { meetingService, type MeetingWithCustomer } from '@/services/meetingService'

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
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
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f5f4f2' }}>
        <h2 className="text-[15px] font-bold flex items-center gap-2" style={{ color: '#1c1917' }}>
          <CalendarDays size={17} style={{ color: '#059669' }} /> הפגישות של היום ({meetings.length})
        </h2>
        <button onClick={() => navigate('/meetings')} className="text-[12px] text-[#059669] hover:underline inline-flex items-center gap-1">
          לכל הפגישות <ChevronLeft size={13} />
        </button>
      </div>
      <div className="divide-y" style={{ borderColor: '#f5f4f2' }}>
        {meetings.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-6 py-3">
            <span className="text-sm font-bold text-[#059669] tabular-nums shrink-0" dir="ltr">
              {new Date(m.starts_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{m.title}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
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
