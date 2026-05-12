import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#faf9f7' }} dir="rtl">
      {/* Mobile sidebar drawer — hidden on desktop */}
      <div className="lg:hidden">
        <Sidebar
          open={sidebarOpen}
          collapsed={false}
          onClose={handleSidebarClose}
          onToggleCollapse={() => {}}
        />
      </div>

      {/* Full-width layout: TopNav + content */}
      <div className="flex flex-col min-h-screen">
        <Header onMenuToggle={handleMenuToggle} />

        <main className="flex-1 p-4 sm:p-6 lg:p-7 w-full max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
