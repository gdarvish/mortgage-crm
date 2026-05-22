import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserPlus, FileText, Calculator,
  RefreshCw, Layers, Bell, MessageSquare, DollarSign, Share2,
  TrendingUp, PieChart, Settings, Menu, X,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '@/theme/ThemeContext'
import { GlobalSearch } from '@/components/GlobalSearch'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  match: string[]
}

const navItems: NavItem[] = [
  { label: 'דשבורד', path: '/dashboard', icon: LayoutDashboard, match: ['/dashboard', '/'] },
  { label: 'לקוחות', path: '/customers', icon: Users, match: ['/customers'] },
  { label: 'לידים', path: '/leads', icon: UserPlus, match: ['/leads'] },
  { label: 'מסמכים', path: '/documents', icon: FileText, match: ['/documents'] },
  { label: 'מחשבון', path: '/calculator', icon: Calculator, match: ['/calculator'] },
  { label: 'מחזור', path: '/refinance', icon: RefreshCw, match: ['/refinance'] },
  { label: 'איחוד', path: '/consolidation', icon: Layers, match: ['/consolidation'] },
  { label: 'התראות', path: '/alerts', icon: Bell, match: ['/alerts'] },
  { label: 'תקשורת', path: '/communication', icon: MessageSquare, match: ['/communication'] },
  { label: 'עמלות', path: '/commissions', icon: DollarSign, match: ['/commissions'] },
  { label: 'מפנים', path: '/referrals', icon: Share2, match: ['/referrals'] },
  { label: 'ריביות', path: '/interest-rates', icon: TrendingUp, match: ['/interest-rates'] },
  { label: 'כלכלה', path: '/family-economics', icon: PieChart, match: ['/family-economics'] },
  { label: 'הגדרות', path: '/settings', icon: Settings, match: ['/settings'] },
]

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const t = useTheme()
  const [hov, setHov] = useState(false)
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: active ? t.navActive : hov ? `${t.navActive}80` : 'transparent',
        color: active ? t.navTextActive : hov ? t.navTextActive : t.navText,
        border: 'none',
        borderBottom: `2px solid ${active ? t.primary : 'transparent'}`,
        borderRadius: '6px 6px 0 0',
        padding: '0 13px',
        height: 58,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'Heebo,sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'color 0.15s ease, background 0.15s ease, border-color 0.2s ease',
      }}
    >
      <Icon size={14} color={active ? t.primary : 'currentColor'} />
      {item.label}
    </button>
  )
}

export default function Header() {
  const t = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [hovBell, setHovBell] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (item: NavItem) =>
    item.match.some((m) => (m === '/' ? location.pathname === '/' : location.pathname.startsWith(m)))

  const handleNav = (path: string) => {
    navigate(path)
    setMenuOpen(false)
  }

  return (
    <>
      <nav
        style={{
          background: t.nav,
          height: 58,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 2,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: `1px solid ${t.navActive}`,
          animation: 'fadeIn 0.4s ease',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 20, flexShrink: 0 }}>
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="דשבורד"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: t.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: `0 4px 12px ${t.primary}50`,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1) rotate(-4deg)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1) rotate(0)' }}
          >
            מ
          </button>
          <span style={{ color: t.navTextActive, fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
            משכנתא CRM
          </span>
        </div>

        {/* Links — desktop only */}
        <div
          className="crm-nav-scroll hidden lg:flex"
          style={{ gap: 1, flex: 1, overflowX: 'auto' }}
        >
          {navItems.map((item) => (
            <NavLink key={item.path} item={item} active={isActive(item)} onClick={() => navigate(item.path)} />
          ))}
        </div>

        {/* Spacer — mobile only */}
        <div className="flex-1 lg:hidden" />

        {/* Search + Bell + Avatar + Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <GlobalSearch />
          <button
            onClick={() => navigate('/alerts')}
            onMouseEnter={() => setHovBell(true)}
            onMouseLeave={() => setHovBell(false)}
            aria-label="התראות"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: t.navActive,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
              transform: hovBell ? 'rotate(-15deg) scale(1.1)' : 'rotate(0) scale(1)',
            }}
          >
            <Bell size={16} color={t.navText} />
            <span
              style={{
                position: 'absolute',
                top: 7,
                right: 7,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ef4444',
                border: `2px solid ${t.nav}`,
              }}
            />
          </button>
          <button
            onClick={() => navigate('/settings')}
            aria-label="הגדרות"
            className="hidden lg:flex"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: `0 2px 8px ${t.primary}40`,
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            ג
          </button>
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'סגור תפריט' : 'פתח תפריט'}
            className="flex lg:hidden"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: t.navActive,
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              color: t.navText,
            }}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[90] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute overflow-y-auto animate-slide-in"
            style={{ top: 58, right: 0, bottom: 0, width: 264, background: t.nav }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '8px 0' }}>
              {navItems.map((item) => {
                const active = isActive(item)
                const Icon = item.icon
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '13px 20px',
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      textAlign: 'right',
                      fontFamily: 'Heebo,sans-serif',
                      background: active ? t.navActive : 'transparent',
                      color: active ? t.navTextActive : t.navText,
                      border: 'none',
                      borderRight: `3px solid ${active ? t.primary : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                  >
                    <Icon size={16} color={active ? t.primary : 'currentColor'} />
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
