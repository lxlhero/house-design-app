import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { TrendingUp, Wallet, ArrowDownToLine, Package } from 'lucide-react'

const COLORS = ['#0066CC', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#FFCC00', '#34C759', '#5AC8FA', '#8E8E93', '#C7C7CC']
const ICONS  = { trending: TrendingUp, wallet: Wallet, remaining: ArrowDownToLine, items: Package }

function formatMoney(v) {
  if (typeof v !== 'number') return '...'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

function StatCard({ label, value, icon, accent, delay }) {
  const Icon = ICONS[icon] || Package
  return (
    <div className={`glass-card p-xl flex items-center gap-lg animate-in animate-in-delay-${delay}`}>
      <div className="w-[44px] h-[44px] rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}14` }}>
        <Icon size={20} strokeWidth={1.8} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-label text-text-secondary uppercase tracking-wider mb-1">{label}</p>
        <p className="stat-number text-text">{value}</p>
      </div>
    </div>
  )
}

function ChartCard({ title, children, delay }) {
  return (
    <div className={`glass-card-static p-xl animate-in animate-in-delay-${delay}`}>
      <h3 className="text-heading font-semibold text-text mb-lg tracking-tight"
        style={{ letterSpacing: 'var(--text-heading--letter-spacing)' }}>
        {title}
      </h3>
      {children}
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
    const t = setTimeout(() => ctrl.abort(), 15000)
    Promise.all([api.overview(), api.categories(), api.phases(), api.floors()])
      .then(([ov, cat, ph, fl]) => {
        setOverview(ov); setCategories(cat); setPhases(ph); setFloors(fl); setError(null)
      }).catch(err => {
        setError(err.name === 'AbortError' ? '网络超时，请刷新' : `加载失败: ${err.message}`)
      }).finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  /* ── 错误 ── */
  if (error) return (
    <div className="flex flex-col items-center justify-center py-3xl gap-lg animate-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl bg-red/8">😞</div>
      <p className="text-callout text-text-secondary">{error}</p>
      <button onClick={() => window.location.reload()} className="btn-secondary">刷新页面</button>
    </div>
  )

  /* ── 骨架加载 ── */
  if (loading) return (
    <div className="space-y-7 animate-in">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="skeleton h-5 w-72 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-lg mt-xl">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <div className="skeleton h-80 rounded-2xl" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    </div>
  )

  const catData = categories.map(c => ({
    name: c.name.length > 5 ? c.name.slice(0,5)+'…' : c.name, full: c.name, value: c.control_budget
  }))
  const floorData = floors.map(f => ({ name: f.floor, value: f.control_budget }))
  const statusData = overview.status_counts ? Object.entries(overview.status_counts).map(([k,v]) => ({ name: k, value: v })) : []

  return (
    <div className="space-y-9 max-w-[1200px]">
      {/* 标题 */}
      <div className="animate-in">
        <p className="text-label text-text-secondary uppercase tracking-wider mb-sm">概览</p>
        <h1 className="text-hero font-bold text-text tracking-tight"
          style={{ letterSpacing: 'var(--text-hero--letter-spacing)', lineHeight: 'var(--text-hero--line-height)' }}>
          仪表盘
        </h1>
        <p className="text-callout text-text-secondary mt-sm">
          总预算 <span className="font-semibold text-text">{formatMoney(overview.total_budget)}</span>
          &nbsp;·&nbsp;{overview.total_items} 个采购项
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-lg">
        <StatCard label="总预算"   value={formatMoney(overview.total_budget)}          icon="trending" accent="#0066CC" delay={1} />
        <StatCard label="实际花费" value={overview.total_actual>0 ? formatMoney(overview.total_actual) : '待录入'} icon="wallet" accent={overview.total_actual>0 ? '#FF9500' : '#C7C7CC'} delay={2} />
        <StatCard label="余额"     value={formatMoney(overview.budget_remaining)}      icon="remaining" accent={overview.budget_remaining>=0 ? '#34C759' : '#FF3B30'} delay={3} />
        <StatCard label="采购项"   value={`${overview.total_items} 项`}                 icon="items" accent="#AF52DE" delay={4} />
      </div>

      {/* 图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <ChartCard title="📊 预算分配" delay={2}>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" outerRadius={95} dataKey="value"
                  label={({ name, value }) => `${name} ¥${(value/10000).toFixed(0)}万`}
                  labelLine={{ strokeWidth: 0.5, stroke: 'rgba(0,0,0,0.12)' }}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip formatter={v => formatMoney(v)} contentStyle={{
                  background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
                  borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: 13
                }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-callout text-text-tertiary text-center py-2xl">暂无数据</p>}
        </ChartCard>

        <ChartCard title="📋 状态分布" delay={3}>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}项`}>
                  {statusData.map((_, i) => <Cell key={i} fill={['#C7C7CC','#34C759','#0066CC','#FF9500','#FF3B30'][i]||COLORS[i]} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ background:'rgba(255,255,255,0.95)', backdropFilter:'blur(12px)', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', boxShadow:'0 4px 16px rgba(0,0,0,0.06)', fontSize:13 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-callout text-text-tertiary text-center py-2xl">暂无数据</p>}
        </ChartCard>
      </div>

      {/* 楼层预算 */}
      {floorData.length > 0 && (
        <ChartCard title="🏗️ 楼层预算对比" delay={4}>
          <ResponsiveContainer width="100%" height={Math.max(180, floorData.length * 44)}>
            <BarChart data={floorData} layout="vertical" margin={{ left: 50 }}>
              <XAxis type="number" tickFormatter={v => `¥${(v/10000).toFixed(0)}万`}
                tick={{ fontSize: 12, fill: '#AEAEB2' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 13, fill: '#1D1D1F', fontWeight: 500 }}
                axisLine={false} tickLine={false} />
              <Tooltip formatter={v => formatMoney(v)} cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                contentStyle={{ background:'rgba(255,255,255,0.95)', backdropFilter:'blur(12px)', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', boxShadow:'0 4px 16px rgba(0,0,0,0.06)', fontSize:13 }} />
              <Bar dataKey="value" fill="#0066CC" radius={[0, 6, 6, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* 预算大项明细 */}
      <div className="glass-card-static overflow-hidden animate-in animate-in-delay-4">
        <div className="px-xl py-lg" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
          <h3 className="text-heading font-semibold text-text tracking-tight">💰 预算大项明细</h3>
        </div>
        <div className="table-wrapper">
          <table className="table-premium">
            <thead><tr>
              <th>预算大项</th><th>控制预算</th><th>占比</th><th>采购时机</th><th>优先级</th><th>进度</th>
            </tr></thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{formatMoney(c.control_budget)}</td>
                  <td className="text-text-secondary">{(c.ratio*100).toFixed(1)}%</td>
                  <td className="text-text-secondary">{c.purchase_timing}</td>
                  <td>
                    <span className={`badge ${c.priority==='最高' ? 'badge-danger' : c.priority==='高' ? 'badge-warning' : ''}`}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="text-text-secondary">
                    <div className="flex items-center gap-sm">
                      <div className="progress-bar flex-1 max-w-[60px]">
                        <div className="progress-bar-fill" style={{ width: `${c.items_total>0?(c.items_completed/c.items_total)*100:0}%` }} />
                      </div>
                      <span className="text-caption">{c.items_completed}/{c.items_total}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 装修阶段 */}
      {phases.length > 0 && (
        <div className="glass-card-static overflow-hidden animate-in animate-in-delay-4">
          <div className="px-xl py-lg" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
            <h3 className="text-heading font-semibold text-text tracking-tight">📅 装修阶段</h3>
          </div>
          <div className="p-xl">
            <div className="relative">
              {phases.map((p, i) => (
                <div key={p.id} className="flex gap-lg pb-lg last:pb-0">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-label font-bold"
                      style={i === 0 ? {
                        background: 'linear-gradient(135deg, #0066CC, #409CFF)', color: 'white',
                        boxShadow: '0 4px 12px rgba(0,102,204,0.25)'
                      } : {
                        background: 'rgba(0,0,0,0.04)', color: '#AEAEB2'
                      }}>
                      {p.phase_num}
                    </div>
                    {i < phases.length - 1 && (
                      <div className="w-px flex-1 mt-sm" style={{ background: 'rgba(0,0,0,0.06)' }} />
                    )}
                  </div>
                  <div className="min-w-0 pb-xs">
                    <div className="flex items-center gap-sm flex-wrap mb-xs">
                      <h4 className="text-callout font-semibold text-text">{p.name}</h4>
                      <span className="badge">{p.month_range}</span>
                    </div>
                    <p className="text-caption text-text-secondary leading-relaxed">{p.core_tasks}</p>
                    {p.related_categories && (
                      <div className="flex flex-wrap gap-xs mt-sm">
                        {p.related_categories.split(/[/,、]/).filter(Boolean).map(cat => (
                          <span key={cat} className="text-caption text-text-tertiary px-sm py-0.5 rounded-full"
                            style={{ background: 'rgba(0,0,0,0.03)' }}>{cat.trim()}</span>
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
