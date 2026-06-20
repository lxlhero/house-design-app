import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, Package, Upload, LayoutGrid, History } from 'lucide-react'
import { api } from '../api'
import { playTap, playClick } from '../sound'

function formatMoney(v) {
  if (!v) return '...'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

const navItems = [
  { to: '/',         icon: Home,        label: '仪表盘' },
  { to: '/items',    icon: Package,      label: '采购清单' },
  { to: '/import',   icon: Upload,       label: '导入数据' },
  { to: '/floorplan',icon: LayoutGrid,   label: '3D户型' },
  { to: '/versions', icon: History,      label: '版本管理' },
]

export default function Layout() {
  const [totalBudget, setTotalBudget] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    api.overview().then(o => setTotalBudget(o.total_budget)).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #F2F2F4 0%, #EDEDEF 100%)' }}>
      {/* ═══════════════ iPad 侧栏（常驻） ═══════════════ */}
      <aside className="
        hidden lg:flex fixed left-0 top-0 h-full w-64 z-20
        flex-col
      " style={{
        background: 'rgba(242,242,244,0.68)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderRight: '0.5px solid rgba(0,0,0,0.06)',
      }}>
        {/* 品牌区 */}
        <div className="px-2xl pt-2xl pb-lg">
          <div className="flex items-center gap-sm mb-sm">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #0066CC, #409CFF)' }}>
              🏠
            </div>
          </div>
          <h1 className="text-heading font-bold text-text tracking-tight"
            style={{ letterSpacing: 'var(--text-heading--letter-spacing)' }}>
            装修管家
          </h1>
          <p className="text-caption text-text-secondary mt-xs">嘉兴 · 五层别墅</p>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-md py-sm space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              onClick={() => playTap()}
              className={({ isActive }) =>
                `flex items-center gap-sm px-md py-sm rounded-lg text-callout font-medium
                transition-all duration-150 ${isActive
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text hover:bg-black/3'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'rgba(0,102,204,0.08)',
                fontWeight: 600,
              } : {}}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span className="tracking-tight">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* 底栏 */}
        <div className="px-2xl py-lg" style={{ borderTop: '0.5px solid rgba(0,0,0,0.05)' }}>
          <p className="text-label text-text-secondary uppercase tracking-wider mb-xs">总预算</p>
          <p className="text-heading font-bold text-text tracking-tight">
            {totalBudget ? formatMoney(totalBudget) : '...'}
          </p>
          <p className="text-caption text-text-tertiary mt-0.5">v2.0 · iPad Edition</p>
        </div>
      </aside>

      {/* ═══════════════ 移动端顶栏 + 抽屉 ═══════════════ */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-lg py-md glass-nav safe-top">
        <div>
          <h1 className="text-callout font-semibold text-text tracking-tight">🏠 装修管家</h1>
          <p className="text-caption text-text-tertiary">嘉兴 · 五层别墅</p>
        </div>
        <button
          onClick={() => { playClick(); setMobileOpen(v => !v) }}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black/3 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {mobileOpen
              ? <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              : <><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>
            }
          </svg>
        </button>
      </header>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)} />
      )}

      {/* 移动端侧栏抽屉 */}
      {mobileOpen && (
        <aside className="lg:hidden fixed left-0 top-0 h-full w-64 z-30 flex flex-col animate-in"
          style={{
            background: 'rgba(250,250,250,0.94)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderRight: '0.5px solid rgba(0,0,0,0.06)',
          }}>
          <div className="px-xl pt-2xl pb-lg safe-top">
            <h1 className="text-heading font-bold text-text">🏠 装修管家</h1>
          </div>
          <nav className="flex-1 px-md py-sm space-y-1" onClick={() => setMobileOpen(false)}>
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-sm px-md py-sm rounded-lg text-callout font-medium
                  transition-all duration-150 ${isActive
                    ? 'text-accent'
                    : 'text-text-secondary'
                  }`
                }
                style={({ isActive }) => isActive ? { background: 'rgba(0,102,204,0.08)' } : {}}
              >
                <Icon size={19} strokeWidth={1.8} />{label}
              </NavLink>
            ))}
          </nav>
        </aside>
      )}

      {/* ═══════════════ 主内容 ═══════════════ */}
      <main className="lg:ml-64 p-lg lg:p-2xl pt-[80px] lg:pt-2xl min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
