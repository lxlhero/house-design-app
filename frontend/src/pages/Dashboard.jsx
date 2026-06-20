import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'

const COLORS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#FFCC00', '#34C759', '#5AC8FA', '#8E8E93', '#C7C7CC']

function formatMoney(v) {
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

function StatCard({ label, value, color }) {
  return (
    <div className="apple-card p-lg flex items-center gap-md">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="min-w-0">
        <p className="text-caption text-secondary-label uppercase tracking-wider">{label}</p>
        <p className="text-title-2 font-bold text-label mt-0.5 truncate">{value}</p>
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

  useEffect(() => {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 15000)

    Promise.all([
      api.overview(), api.categories(), api.phases(), api.floors()
    ]).then(([ov, cat, ph, fl]) => {
      setOverview(ov); setCategories(cat); setPhases(ph); setFloors(fl); setError(null)
    }).catch(err => {
      if (err.name === 'AbortError') setError('网络超时，请检查网络后刷新')
      else setError('加载失败：' + (err.message || '未知错误'))
    }).finally(() => {
      clearTimeout(timeout); setLoading(false)
    })
  }, [])

  if (error) return (
    <div className="flex flex-col items-center justify-center py-xxl gap-md">
      <div className="text-4xl">😞</div>
      <p className="text-callout text-secondary-label">{error}</p>
      <button onClick={() => window.location.reload()} className="apple-btn-secondary">刷新页面</button>
    </div>
  )

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-xxl gap-md">
      <div className="w-8 h-8 border-2 border-blue/20 border-t-blue rounded-full animate-spin" />
      <p className="text-callout text-secondary-label">正在加载数据…</p>
    </div>
  )

  const catChartData = categories.map(c => ({
    name: c.name.length > 6 ? c.name.slice(0, 6) + '…' : c.name,
    fullName: c.name,
    value: c.control_budget,
    spent: c.actual_spent,
  }))

  const floorChartData = floors.map(f => ({ name: f.floor, value: f.control_budget }))
  const statusData = overview.status_counts ? Object.entries(overview.status_counts).map(([k, v]) => ({ name: k, value: v })) : []

  return (
    <div className="space-y-xl">
      {/* 标题 */}
      <div>
        <h2 className="text-large-title font-bold text-label tracking-tight">仪表盘</h2>
        <p className="text-callout text-secondary-label mt-xs">
          嘉兴五层别墅 · 总预算 {formatMoney(overview.total_budget)}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        <StatCard label="总预算" value={formatMoney(overview.total_budget)} color="#007AFF" />
        <StatCard label="实际花费" value={overview.total_actual > 0 ? formatMoney(overview.total_actual) : '待录入'} color={overview.total_actual > 0 ? '#FF9500' : '#C7C7CC'} />
        <StatCard label="预算余额" value={formatMoney(overview.budget_remaining)} color={overview.budget_remaining >= 0 ? '#34C759' : '#FF3B30'} />
        <StatCard label="采购项" value={`${overview.total_items} 项`} color="#AF52DE" />
      </div>

      {/* 图表行 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {/* 预算分配饼图 */}
        <div className="apple-card p-xl">
          <h3 className="text-subhead text-label mb-lg">📊 预算分配</h3>
          {catChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={catChartData} cx="50%" cy="50%" outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name} ¥${(value/10000).toFixed(0)}万`}
                  labelLine={{ strokeWidth: 0.5, stroke: 'rgba(60,60,67,0.2)' }}
                >
                  {catChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-callout text-tertiary-label text-center py-xl">暂无数据</p>
          )}
        </div>

        {/* 状态分布 */}
        <div className="apple-card p-xl">
          <h3 className="text-subhead text-label mb-lg">📋 状态分布</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}项`}
                >
                  {statusData.map((_, i) => <Cell key={i} fill={['#C7C7CC', '#34C759', '#007AFF', '#FF9500', '#FF3B30'][i] || COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-callout text-tertiary-label text-center py-xl">暂无数据</p>
          )}
        </div>
      </div>

      {/* 楼层预算对比 */}
      {floorChartData.length > 0 && (
        <div className="apple-card p-xl">
          <h3 className="text-subhead text-label mb-lg">🏗️ 楼层预算对比</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, floorChartData.length * 44)}>
            <BarChart data={floorChartData} layout="vertical" margin={{ left: 50 }}>
              <XAxis type="number" tickFormatter={v => `¥${(v/10000).toFixed(0)}万`} tick={{ fontSize: 12, fill: 'rgba(60,60,67,0.6)' }} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 13, fill: '#000' }} />
              <Tooltip formatter={v => formatMoney(v)} />
              <Bar dataKey="value" fill="#007AFF" radius={[0, 6, 6, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 预算大项明细表 */}
      <div className="apple-card overflow-hidden">
        <div className="px-xl py-lg" style={{ borderBottom: '0.5px solid rgba(60,60,67,0.2)' }}>
          <h3 className="text-subhead text-label">💰 预算大项明细</h3>
        </div>
        <div className="table-wrapper">
          <table className="apple-table">
            <thead>
              <tr>
                <th>预算大项</th>
                <th>控制预算</th>
                <th>占比</th>
                <th>采购时机</th>
                <th>优先级</th>
                <th>进度</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{formatMoney(c.control_budget)}</td>
                  <td className="text-secondary-label">{(c.ratio * 100).toFixed(1)}%</td>
                  <td className="text-secondary-label">{c.purchase_timing}</td>
                  <td>
                    <span className={`apple-badge ${c.priority === '最高' ? 'apple-badge-active' : ''}`}
                      style={c.priority !== '最高' ? (
                        c.priority === '高' ? { background: 'rgba(255,149,0,0.12)', color: '#FF9500' } :
                        {}
                      ) : {}}
                    >{c.priority}</span>
                  </td>
                  <td className="text-secondary-label">{c.items_completed}/{c.items_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 装修阶段时间线 */}
      {phases.length > 0 && (
        <div className="apple-card overflow-hidden">
          <div className="px-xl py-lg" style={{ borderBottom: '0.5px solid rgba(60,60,67,0.2)' }}>
            <h3 className="text-subhead text-label">📅 装修阶段</h3>
          </div>
          <div className="p-xl">
            <div className="relative">
              {phases.map((p, i) => (
                <div key={p.id} className="flex gap-md pb-lg last:pb-0">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold text-white ${
                      i === 0 ? 'bg-blue shadow-[0_0_0_3px_rgba(0,122,255,0.15)]' : 'bg-border'
                    }`}>{p.phase_num}</div>
                    {i < phases.length - 1 && <div className="w-px flex-1 bg-separator mt-sm" />}
                  </div>
                  <div className="min-w-0 pb-sm">
                    <div className="flex items-center gap-sm flex-wrap">
                      <h4 className="text-callout font-semibold text-label">{p.name}</h4>
                      <span className="apple-badge">{p.month_range}</span>
                    </div>
                    <p className="text-footnote text-secondary-label mt-xs leading-relaxed">{p.core_tasks}</p>
                    {p.related_categories && (
                      <div className="flex flex-wrap gap-xs mt-sm">
                        {p.related_categories.split(/[/,、]/).filter(Boolean).map(cat => (
                          <span key={cat} className="text-caption text-tertiary-label bg-grouped px-sm py-0.5 rounded-full">{cat.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
