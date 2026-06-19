import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, Package, Upload, History, LayoutGrid } from 'lucide-react'
import { api } from '../api'

function formatMoney(v) {
  if (!v) return '-'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

export default function Layout() {
  const [totalBudget, setTotalBudget] = useState(null)

  useEffect(() => {
    api.overview().then(ov => {
      // overview.total_budget 是 categories 的总和，加上预备金 40000 才是 120万
      setTotalBudget(ov.total_budget)
    })
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-zinc-100">
      <aside className="fixed left-0 top-0 h-full w-56 bg-white/80 backdrop-blur border-r border-zinc-200 flex flex-col">
        <div className="px-5 py-6 border-b border-zinc-100">
          <h1 className="text-lg font-bold text-zinc-800 tracking-tight">🏠 装修管家</h1>
          <p className="text-xs text-zinc-400 mt-1">嘉兴五层别墅</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { to: '/', icon: Home, label: '仪表盘' },
            { to: '/items', icon: Package, label: '采购清单' },
            { to: '/import', icon: Upload, label: '导入数据' },
            { to: '/versions', icon: History, label: '版本管理' },
            { to: '/floorplan', icon: LayoutGrid, label: '3D户型' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
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

      <main className="ml-56 p-8 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
