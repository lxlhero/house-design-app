import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, Package, Upload, LayoutGrid, Bot, Menu, X } from 'lucide-react'
import { api } from '../api'

function formatMoney(v) {
  if (!v) return '-'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

export default function Layout() {
  const [totalBudget, setTotalBudget] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    api.overview().then(ov => {
      setTotalBudget(ov.total_budget)
    })
  }, [])

  // 关闭侧栏当点击导航或遮罩
  const closeSidebar = () => setSidebarOpen(false)

  const navItems = [
    { to: '/', icon: Home, label: '仪表盘' },
    { to: '/items', icon: Package, label: '采购清单' },
    { to: '/import', icon: Upload, label: '导入数据' },
    { to: '/floorplan', icon: LayoutGrid, label: '3D户型' },
    { to: '/agent',     icon: Bot,        label: 'Mom Agent' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-zinc-100">

      {/* ── 移动/iPad 顶部栏 ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur border-b border-zinc-200 safe-top">
        <h1 className="text-base font-bold text-zinc-800">🏠 装修管家</h1>
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="p-2 -mr-2 rounded-lg hover:bg-zinc-100"
          aria-label="菜单"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ── 遮罩（移动/iPad） ── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* ── 侧栏 ── */}
      <aside className={`
        fixed left-0 top-0 h-full w-56 bg-white/80 backdrop-blur border-r border-zinc-200
        flex flex-col z-30 transition-transform duration-200
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-5 py-6 border-b border-zinc-100 hidden lg:block">
          <h1 className="text-lg font-bold text-zinc-800 tracking-tight">🏠 装修管家</h1>
          <p className="text-xs text-zinc-400 mt-1">嘉兴五层别墅</p>
        </div>
        {/* 移动端标题（在 sidebar 内） */}
        <div className="px-5 py-6 border-b border-zinc-100 lg:hidden">
          <h1 className="text-lg font-bold text-zinc-800">🏠 装修管家</h1>
          <p className="text-xs text-zinc-400 mt-1">嘉兴五层别墅</p>
        </div>
        <nav className="flex-1 p-3 space-y-1" onClick={closeSidebar}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-zinc-100 text-xs text-zinc-400">
          总预算 {totalBudget ? formatMoney(totalBudget) : '...'} · v1.1
        </div>
      </aside>

      {/* ── 主内容区 ── */}
      <main className="lg:ml-56 p-4 md:p-6 lg:p-8 pt-16 lg:pt-8 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
