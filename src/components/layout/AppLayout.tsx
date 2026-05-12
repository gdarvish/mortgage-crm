import { Outlet } from 'react-router-dom'
import Header from '@/components/layout/Header'

export default function AppLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#faf9f7' }} dir="rtl">

      {/* Full-width layout: TopNav + content */}
      <div className="flex flex-col min-h-screen">
        <Header />

        <main className="flex-1 p-4 sm:p-6 lg:p-7 w-full max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
