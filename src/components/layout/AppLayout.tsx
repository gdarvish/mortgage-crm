import { Outlet } from 'react-router-dom'
import Header from '@/components/layout/Header'

export default function AppLayout() {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
      dir="rtl"
    >

      {/* Full-width layout: TopNav + content */}
      <div className="flex flex-col min-h-screen">
        <Header />

        {/* Padding belongs to the page shell (.crm-page), so a page can
            run edge to edge when it needs to. */}
        <main className="flex-1 w-full max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
