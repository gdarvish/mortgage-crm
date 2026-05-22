import { Outlet } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { useTheme } from '@/theme/ThemeContext'

export default function AppLayout() {
  const t = useTheme()
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: t.bg, transition: 'background 0.3s' }}
      dir="rtl"
    >
      <Header />
      <main className="w-full max-w-full overflow-x-hidden" style={{ minHeight: 'calc(100vh - 58px)' }}>
        <Outlet />
      </main>
    </div>
  )
}
