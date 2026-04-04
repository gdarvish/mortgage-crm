import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { cn } from '@/lib/utils'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => !prev)
  }, [])

  return (
    <div className="min-h-screen bg-[#f8fafc]" dir="rtl">
      {/* Sidebar - right side in RTL */}
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={handleSidebarClose}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main content area - offset from sidebar on the right */}
      <div
        className={cn(
          'transition-all duration-300',
          // In RTL, margin-right pushes content away from the right sidebar
          sidebarCollapsed
            ? 'lg:mr-[72px]'
            : 'lg:mr-[260px]'
        )}
      >
        <Header
          onMenuToggle={handleMenuToggle}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
