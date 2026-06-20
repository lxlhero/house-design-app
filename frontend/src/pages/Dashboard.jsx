import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../api'
import { TrendingUp, Package, Wallet, ArrowDownToLine, Edit3, Check, X, ChevronDown, ChevronRight, ShoppingCart, RefreshCw } from 'lucide-react'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6']

function formatMoney(v) {
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-zinc-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-zinc-800">{value}</p>
      </div>
    </div>
  )
}

const STATUS_COLORS = {
  '未开始': 'bg-zinc-100 text-zinc-500',
  '已下单': 'bg-blue-50 text-blue-600',
  '已支付': 'bg-amber-50 text-amber-600',
  '已到货': 'bg-violet-50 text-violet-600',
  '已安装': 'bg-emerald-50 text-emerald-600',
  '已完成': 'bg-emerald-100 text-emerald-700',
}

const STATUS_DOTS = {
  '未开始': '⬜',
  '已下单': '📦',
  '已支付': '💳',
  '已到货': '🚚',
  '已安装': '🔧',
  '已完成': '✅',
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null)
  const [categories, setCategories] = useState([])
  const [phases, setPhases] = useState([])
  const [floors, setFloors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [expandedCats, setExpandedCats] = useState({})

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    Promise.all([
      api.overview(), api.categories(true), api.phases(), api.floors()
    ]).then(([ov, cat, ph, fl]) => {
      setOverview(ov)
      setCategories(cat)
      setPhases(ph)
      setFloors(fl)
      setError(null)
    }).catch(err => {
      if (err.name === 'AbortError') {
        setError('网络超时，请检查网络后刷新页面')
      } else {
        setError('加载失败：' + (err.message || '未知错误'))
      }
    }).finally(() => {
      clearTimeout(timeout)
      setLoading(false)
    })
  }, [])

  // 页面切回时自动刷新数据（Agent 修改后仪表盘即时可见）
  const fetchData = async () => {
    try {
      const [ov, cat, ph, fl] = await Promise.all([
        api.overview(), api.categories(true), api.phases(), api.floors()
      ])
      setOverview(ov)
      setCategories(cat)
      setPhases(ph)
      setFloors(fl)
    } catch {}
  }
  useEffect(() => {
    const reload = () => fetchData()
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData() }
    // pageshow: iOS Safari 切回 tab 时触发（比 visibilitychange 更可靠）
    window.addEventListener('pageshow', reload)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pageshow', reload)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const toggleCat = (id) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const saveBudget = async () => {
    const val = parseFloat(budgetInput) * 10000
    if (val > 0) {
      await api.updateBudget(val)
      fetchData()
    }
    setEditingBudget(false)
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3">
      <div className="text-4xl">😞</div>
      <div className="text-zinc-600 text-sm">{error}</div>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-6 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors"
      >刷新页面</button>
    </div>
  )

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full" />
      <div className="text-zinc-400 text-sm">正在加载数据…</div>
    </div>
  )

  const catChartData = categories.map(c => ({
    name: c.name.length > 6 ? c.name.slice(0, 6) + '..' : c.name,
    fullName: c.name,
    value: c.control_budget,
    spent: c.actual_spent,
  }))

  const floorChartData = floors.map(f => ({
    name: f.floor,
    value: f.control_budget,
  }))

  const statusData = Object.entries(overview.status_counts).map(([k, v]) => ({ name: k, value: v }))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-zinc-800">仪表盘</h2>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-indigo-500 transition-colors"
            title="刷新数据"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <p className="text-sm text-zinc-500 mt-1">嘉兴五层别墅 · 总预算 {formatMoney(overview.total_budget)}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-indigo-500">
            <TrendingUp size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400 font-medium">总预算</p>
            {editingBudget ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number" value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  className="w-16 text-lg font-bold border border-indigo-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 ring-indigo-300"
                  placeholder="万"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveBudget()}
                />
                <span className="text-sm text-zinc-500">万</span>
                <button onClick={saveBudget} className="text-emerald-500 hover:text-emerald-700"><Check size={16} /></button>
                <button onClick={() => setEditingBudget(false)} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
              </div>
            ) : (
              <button
                onClick={() => { setBudgetInput((overview.total_budget / 10000).toFixed(1)); setEditingBudget(true) }}
                className="text-xl font-bold text-zinc-800 hover:text-indigo-600 cursor-pointer flex items-center gap-1 group"
              >
                {formatMoney(overview.total_budget)}
                <Edit3 size={14} className="opacity-0 group-hover:opacity-50 text-zinc-400 transition-opacity" />
              </button>
            )}
          </div>
        </div>
        <StatCard icon={Wallet} label="实际花费" value={formatMoney(overview.total_actual) || '待录入'} color={overview.total_actual > 0 ? 'bg-amber-500' : 'bg-zinc-400'} />
        <StatCard icon={ArrowDownToLine} label="预算余额" value={formatMoney(overview.budget_remaining)} color={overview.budget_remaining >= 0 ? 'bg-emerald-500' : 'bg-red-500'} />
        <StatCard icon={Package} label="采购项" value={`${overview.total_items} 项`} color="bg-violet-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-700 mb-4">📊 预算分配</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={catChartData}
                cx="50%" cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name} ¥${(value/10000).toFixed(1)}万`}
                labelLine={{ strokeWidth: 1, stroke: '#d4d4d8' }}
              >
                {catChartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-700 mb-4">📋 状态分布</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}项`}
              >
                {statusData.map((_, i) => (
                  <Cell key={i} fill={['#a1a1aa', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444'][i] || COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar: Floor budgets */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-700 mb-4">🏗️ 楼层预算对比</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={floorChartData} layout="vertical">
            <XAxis type="number" tickFormatter={v => `¥${(v/10000).toFixed(0)}万`} />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip formatter={v => formatMoney(v)} />
            <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Budget categories — expandable table */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-700">💰 预算大项明细</h3>
        </div>
        <div className="overflow-x-auto">
          {categories.map((cat, idx) => {
            const isExpanded = expandedCats[cat.id]
            const catBudget = cat.control_budget
            const catSpent = cat.actual_spent
            const pct = catBudget > 0 ? Math.round(catSpent / catBudget * 100) : 0

            return (
              <div key={cat.id} className="border-b border-zinc-50">
                {/* Category row (click to expand) */}
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-50/50 transition-colors text-left"
                >
                  <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    <ChevronRight size={14} className="text-zinc-400" />
                  </span>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="font-medium text-zinc-800 text-sm min-w-[80px]">{cat.name}</span>
                  <div className="flex items-center gap-3 ml-auto text-xs">
                    {/* Budget bar */}
                    <div className="hidden md:flex items-center gap-2 min-w-[140px]">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-zinc-500 w-8 text-right">{pct}%</span>
                    </div>
                    <span className="text-zinc-600 font-medium w-20 text-right">
                      {formatMoney(catSpent)} / {formatMoney(catBudget)}
                    </span>
                    <span className="text-zinc-400 w-16 text-right">
                      <span className="text-emerald-600">{cat.items_completed}</span>
                      {cat.items_active > 0 && <span className="text-blue-500">+{cat.items_active}</span>}
                      /{cat.items_total} 项
                    </span>
                    {cat.priority === '最高' && (
                      <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium">最高</span>
                    )}
                  </div>
                </button>

                {/* Expanded items */}
                {isExpanded && cat.items && (
                  <div className="bg-zinc-50/50 border-t border-zinc-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-100 text-left text-zinc-400">
                          <th className="px-5 py-2 font-normal">采购项</th>
                          <th className="px-2 py-2 font-normal hidden md:table-cell">空间</th>
                          <th className="px-2 py-2 font-normal">预算</th>
                          <th className="px-2 py-2 font-normal hidden md:table-cell">实际花费</th>
                          <th className="px-2 py-2 font-normal">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.items.map(item => (
                          <tr key={item.id} className="border-b border-zinc-50/50">
                            <td className="px-5 py-2">
                              <div className="font-medium text-zinc-700">{item.item_name}</div>
                              {item.notes && (
                                <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[200px]">{item.notes}</div>
                              )}
                            </td>
                            <td className="px-2 py-2 text-zinc-400 hidden md:table-cell">{item.floor_space}</td>
                            <td className="px-2 py-2 text-zinc-600 font-medium">
                              {formatMoney(item.control_budget)}
                            </td>
                            <td className="px-2 py-2 hidden md:table-cell">
                              {item.actual_cost > 0 ? (
                                <span className={item.actual_cost > item.control_budget ? 'text-red-500' : 'text-zinc-600'}>
                                  {formatMoney(item.actual_cost)}
                                </span>
                              ) : (
                                <span className="text-zinc-300">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${STATUS_COLORS[item.status] || 'bg-zinc-100 text-zinc-500'}`}>
                                {STATUS_DOTS[item.status] || ''} {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {cat.items.length === 0 && (
                      <p className="text-xs text-zinc-400 text-center py-4">暂无采购项</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Phases timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-700">
            📅 装修阶段
            {(() => {
              const cur = phases.find(p => p.status === 'current')
              return cur ? `（当前：${cur.name}）` : ''
            })()}
          </h3>
        </div>
        <div className="p-5">
          <div className="relative">
            {phases.map((p, i) => {
              const isCurrent = p.status === 'current'
              const isCompleted = p.status === 'completed'
              return (
              <div key={p.id} className="flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    isCompleted ? 'bg-emerald-500' :
                    isCurrent ? 'bg-indigo-500 ring-4 ring-indigo-100' :
                    'bg-zinc-300'
                  }`}>
                    {isCompleted ? '✓' : p.phase_num}
                  </div>
                  {i < phases.length - 1 && (
                    <div className={`w-0.5 flex-1 mt-1 ${isCompleted ? 'bg-emerald-200' : 'bg-zinc-200'}`} />
                  )}
                </div>
                <div className={`flex-1 min-w-0 ${isCompleted ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-zinc-800">{p.name}</h4>
                    <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">{p.month_range}</span>
                    {isCompleted && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">已完成</span>}
                    {isCurrent && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">进行中</span>}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{p.core_tasks}</p>
                  <div className="flex flex-wrap gap-2 mt-2 items-center">
                    {p.related_categories?.split(/[/,、]/).filter(Boolean).map(cat => (
                      <span key={cat} className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{cat.trim()}</span>
                    ))}
                    {isCurrent && (
                      <button
                        onClick={async () => { await api.advancePhase(p.id); setPhases(await api.phases()) }}
                        className="text-[10px] bg-indigo-500 text-white px-2 py-1 rounded-full hover:bg-indigo-600 transition-colors ml-auto"
                      >✅ 完成</button>
                    )}
                    {isCompleted && (
                      <button
                        onClick={async () => { await api.rollbackPhase(p.id); setPhases(await api.phases()) }}
                        className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full hover:bg-amber-200 transition-colors ml-auto"
                      >↩ 回退</button>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}
