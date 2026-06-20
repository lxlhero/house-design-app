import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, Package, Upload, History, LayoutGrid, Menu, X } from 'lucide-react'
import { api } from '../api'

function formatMoney(v) {
  if (!v) return '...'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

export default function Layout() {
  const [totalBudget, setTotalBudget] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    api.overview().then(ov => setTotalBudget(ov.total_budget)).catch(() => {})
  }, [])

  const closeSidebar = () => setSidebarOpen(false)

  const navItems = [
    { to: '/', icon: Home, label: '仪表盘' },
    { to: '/items', icon: Package, label: '采购清单' },
    { to: '/import', icon: Upload, label: '导入数据' },
    { to: '/floorplan', icon: LayoutGrid, label: '3D户型' },
    { to: '/versions', icon: History, label: '版本管理' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* ── 移动/iPad 顶部毛玻璃导航 ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-lg py-md apple-nav safe-top">
        <h1 className="text-callout font-semibold text-label tracking-tight">🏠 装修管家</h1>
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="p-sm -mr-sm rounded-full hover:bg-separator transition-colors"
          aria-label="菜单"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* ── 遮罩 ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-label/20 backdrop-blur-sm" onClick={closeSidebar} />
      )}

      {/* ── 侧栏（毛玻璃） ── */}
      <aside className={`
        fixed left-0 top-0 h-full w-60 z-30
        flex flex-col transition-transform duration-200 ease-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
        style={{
          background: 'rgba(242,242,247,0.88)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRight: '0.5px solid rgba(60,60,67,0.2)',
        }}
      >
        {/* 标题区 */}
        <div className="px-xl py-6 lg:py-8" style={{ borderBottom: '0.5px solid rgba(60,60,67,0.2)' }}>
          <h1 className="text-title-2 font-bold text-label tracking-tight">🏠 装修管家</h1>
          <p className="text-footnote text-secondary-label mt-xs">嘉兴五层别墅</p>
        </div>

        {/* 导航项 */}
        <nav className="flex-1 px-sm py-sm space-y-0.5" onClick={closeSidebar}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-md py-sm rounded-md text-callout font-medium transition-all ${
                  isActive
                    ? 'bg-blue/10 text-blue'
                    : 'text-label hover:bg-separator'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* 底部 */}
        <div className="px-xl py-md" style={{ borderTop: '0.5px solid rgba(60,60,67,0.2)' }}>
          <p className="text-caption text-secondary-label">
            总预算 {totalBudget ? formatMoney(totalBudget) : '...'} · v1.2
          </p>
        </div>
      </aside>

      {/* ── 主内容区 ── */}
      <main className="lg:ml-60 p-lg lg:p-xxl pt-[68px] lg:pt-xxl min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
