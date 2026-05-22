import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserPlus, FileText, Calculator,
  Bell, DollarSign, Settings, Menu, X, Share2,
  RefreshCw, Layers, TrendingUp, Heart, MessageSquare, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlobalSearch } from '@/components/GlobalSearch'

interface HeaderProps {
  sidebarCollapsed?: boolean
}

const navItems = [
  { label: 'דשבורד',   path: '/dashboard',   icon: LayoutDashboard },
  { label: 'לקוחות',   path: '/customers',   icon: Users },
  { label: 'לידים',    path: '/leads',        icon: UserPlus },
  { label: 'מסמכים',   path: '/documents',   icon: FileText },
  { label: 'מחשבון',   path: '/calculator',  icon: Calculator },
  { label: 'התראות',   path: '/alerts',      icon: Bell },
  { label: 'עמלות',    path: '/commissions', icon: DollarSign },
  { label: 'הגדרות',   path: '/settings',    icon: Settings },
]

const mobileExtraItems = [
  { label: 'יומן שינויים', path: '/audit-log',     icon: History },
  { label: 'תקשורת',       path: '/communication', icon: MessageSquare },
  { label: 'שותפי הפניה', path: '/referrals',     icon: Share2 },
  { label: 'ריביות',       path: '/rates',          icon: TrendingUp },
  { label: 'מחזור',        path: '/refinance',      icon: RefreshCw },
  { label: 'איחוד הלוואות', path: '/consolidation', icon: Layers },
  { label: 'כלכלת משפחה', path: '/family',          icon: Heart },
]

export default function Header(_props: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const notificationCount = 0

  function isActive(path: string) {
    if (path === '/dashboard') return location.pathname === path || location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const handleNav = (path: string) => {
    navigate(path)
    setMenuOpen(false)
  }

  const allMobileItems = [...navItems, ...mobileExtraItems]

  return (
    <>
      <header
        className="sticky top-0 z-[100] flex items-center w-full shrink-0"
        style={{ height: 58, background: '#1c1917' }}
      >
        {/* Logo */}
        <div className="flex items-center px-4 shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center text-white font-black text-lg transition-transform duration-200 hover:scale-110 hover:-rotate-[4deg]"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: '#059669',
              boxShadow: '0 4px 12px rgba(5,150,105,0.5)',
            }}
            aria-label="דשבורד"
          >
            מ
          </button>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch my-3 shrink-0" style={{ background: '#292524' }} />

        {/* Nav links — desktop only */}
        <nav className="hidden lg:flex items-stretch flex-1 h-full overflow-x-auto">
          {navItems.map((item) => {
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 h-full text-[13px] transition-all duration-150 whitespace-nowrap shrink-0',
                  active ? 'font-semibold' : 'hover:bg-[#292524]/50 font-medium'
                )}
                style={{
                  color: active ? '#fafaf9' : '#a8a29e',
                  background: active ? '#292524' : undefined,
                  borderBottom: active ? '2px solid #059669' : '2px solid transparent',
                }}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="lg:hidden flex items-center justify-center mx-2 transition-colors hover:text-[#fafaf9]"
          style={{ width: 36, height: 36, borderRadius: 10, color: '#a8a29e' }}
          aria-label="פתח תפריט"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Spacer (mobile) */}
        <div className="flex-1 lg:hidden" />

        {/* Right side actions */}
        <div className="flex items-center gap-1 px-3 shrink-0">
          {/* Global search */}
          <GlobalSearch />

          {/* Bell */}
          <button
            className="relative flex items-center justify-center transition-all duration-200 hover:rotate-[-15deg] hover:scale-110"
            style={{ width: 36, height: 36, borderRadius: 10, color: '#a8a29e' }}
            aria-label="התראות"
            onClick={() => navigate('/alerts')}
          >
            <Bell size={16} />
            {notificationCount > 0 && (
              <span
                className="absolute top-[7px] right-[7px] rounded-full bg-red-500"
                style={{ width: 8, height: 8 }}
              />
            )}
          </button>

          {/* Avatar */}
          <button
            className="flex items-center justify-center text-white font-bold text-sm transition-transform duration-150 hover:scale-[1.08]"
            style={{ width: 36, height: 36, borderRadius: 10, background: '#059669' }}
            aria-label="פרופיל"
            onClick={() => navigate('/settings')}
          >
            מ
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[90] lg:hidden"
          style={{ background: 'rgba(28,25,23,0.6)' }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-[58px] right-0 h-full overflow-y-auto animate-fade-in"
            style={{ width: 260, background: '#1c1917' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="py-3">
              {allMobileItems.map((item) => {
                const active = isActive(item.path)
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-[14px] transition-colors text-right"
                    style={{
                      color: active ? '#fafaf9' : '#a8a29e',
                      background: active ? '#292524' : 'transparent',
                      borderRight: active ? '3px solid #059669' : '3px solid transparent',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
