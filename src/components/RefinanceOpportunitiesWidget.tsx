import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, ChevronLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { alertService } from '@/services/alertService'

export default function RefinanceOpportunitiesWidget() {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [totalSaving, setTotalSaving] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    alertService.getAll({ status: 'פתוח' }).then(({ data }) => {
      const refi = (data ?? []).filter(a => a.alert_type === 'refinance_opportunity')
      setCount(refi.length)
      setTotalSaving(refi.reduce((s, a) => {
        const saving = (a.metadata as { monthly_saving?: number } | null | undefined)?.monthly_saving ?? 0
        return s + saving
      }, 0))
      setLoaded(true)
    })
  }, [])

  if (!loaded || count === 0) return null

  return (
    <button
      onClick={() => navigate('/alerts')}
      className="w-full text-right"
      style={{
        background: 'linear-gradient(135deg, #ecfdf5, var(--color-success-bg))',
        borderRadius: 20,
        border: '1px solid #a7f3d0',
        padding: '18px 24px',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: 'var(--color-primary)' }}>
            <TrendingDown size={22} className="text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold" style={{ color: '#065f46' }}>
              הזדמנויות מחזור: {count} {count === 1 ? 'לקוח' : 'לקוחות'}
            </p>
            {totalSaving > 0 && (
              <p className="text-[13px]" style={{ color: 'var(--color-primary)' }}>
                חיסכון חודשי מצטבר ~{formatCurrency(totalSaving)}
              </p>
            )}
          </div>
        </div>
        <ChevronLeft size={18} style={{ color: 'var(--color-primary)' }} />
      </div>
    </button>
  )
}
