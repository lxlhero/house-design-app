import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../api'
import { TrendingUp, Package, Wallet, ArrowDownToLine, Edit3, Check, X } from 'lucide-react'

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

export default function Dashboard() {
  const [overview, setOverview] = useState(null)
  const [categories, setCategories] = useState([])
  const [phases, setPhases] = useState([])
  const [floors, setFloors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15秒超时

    Promise.all([
      api.overview(), api.categories(), api.phases(), api.floors()
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

  const saveBudget = async () => {
    const val = parseFloat(budgetInput) * 10000  // 用户输入的是"万"
    if (val > 0) {
      await api.updateBudget(val)
      const ov = await api.overview()
      const cat = await api.categories()
      setOverview(ov)
      setCategories(cat)
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
        <h2 className="text-2xl font-bold text-zinc-800">仪表盘</h2>
        <p className="text-sm text-zinc-500 mt-1">嘉兴五层别墅 · 总预算 {formatMoney(overview.total_budget)}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 可编辑的总预算 */}
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
        {/* Pie: Budget by category */}
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

        {/* Pie: Status distribution */}
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

      {/* Budget categories table */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-700">💰 预算大项明细</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50 text-left text-xs text-zinc-400 uppercase">
              <th className="px-5 py-3">预算大项</th>
              <th className="px-5 py-3">控制预算</th>
              <th className="px-5 py-3">占比</th>
              <th className="px-5 py-3">采购时机</th>
              <th className="px-5 py-3">优先级</th>
              <th className="px-5 py-3">进度</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                <td className="px-5 py-3 font-medium text-zinc-800">{c.name}</td>
                <td className="px-5 py-3 text-zinc-600">{formatMoney(c.control_budget)}</td>
                <td className="px-5 py-3 text-zinc-500">{(c.ratio * 100).toFixed(1)}%</td>
                <td className="px-5 py-3 text-zinc-500">{c.purchase_timing}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${
                    c.priority === '最高' ? 'bg-red-50 text-red-600' :
                    c.priority === '高' ? 'bg-amber-50 text-amber-600' :
                    'bg-zinc-100 text-zinc-500'
                  }`}>{c.priority}</span>
                </td>
                <td className="px-5 py-3 text-zinc-400">{c.items_completed}/{c.items_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
                        onClick={async () => {
                          await api.advancePhase(p.id)
                          const ps = await api.phases()
                          setPhases(ps)
                        }}
                        className="text-[10px] bg-indigo-500 text-white px-2 py-1 rounded-full hover:bg-indigo-600 transition-colors ml-auto"
                      >✅ 标记完成</button>
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
