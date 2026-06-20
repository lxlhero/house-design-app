import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { Search, Filter, ChevronDown, Edit3, Check, X, RotateCcw, TrendingDown, TrendingUp, Download } from 'lucide-react'

const STATUS_OPTIONS = ['未开始', '询价中', '已定方案', '已下单', '已安装', '延期']
const STATUS_COLORS = {
  '未开始': 'bg-zinc-100 text-zinc-500',
  '询价中': 'bg-blue-50 text-blue-600',
  '已定方案': 'bg-purple-50 text-purple-600',
  '已下单': 'bg-amber-50 text-amber-600',
  '已安装': 'bg-emerald-50 text-emerald-600',
  '延期': 'bg-red-50 text-red-600',
}
const PRIORITY_COLORS = {
  '最高': 'bg-red-50 text-red-600',
  '高': 'bg-amber-50 text-amber-600',
  '中高': 'bg-blue-50 text-blue-600',
  '中': 'bg-zinc-100 text-zinc-500',
  '低': 'bg-zinc-50 text-zinc-400',
}

function formatMoney(v) {
  if (!v && v !== 0) return '-'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

function formatVariance(budget, actual) {
  if (!actual && actual !== 0) return null
  const diff = budget - actual
  return { diff, abs: Math.abs(diff), over: diff < 0 }
}

// Inline editable number cell
function EditableNumber({ value, onSave, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || 0)

  const save = () => {
    onSave(Number(val) || 0)
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number" value={val} onChange={e => setVal(e.target.value)}
          className="w-20 text-xs border border-indigo-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 ring-indigo-300"
          autoFocus onKeyDown={e => e.key === 'Enter' && save()}
        />
        <button onClick={save} className="text-emerald-500 hover:text-emerald-700"><Check size={14} /></button>
        <button onClick={() => { setVal(value || 0); setEditing(false) }} className="text-zinc-400 hover:text-zinc-600"><X size={14} /></button>
      </span>
    )
  }

  return (
    <button onClick={() => setEditing(true)}
      className={`text-zinc-500 hover:text-indigo-600 cursor-pointer hover:bg-indigo-50 px-1 -mx-1 rounded transition-colors ${className}`}
    >
      {formatMoney(value)}
      <Edit3 size={10} className="inline ml-1 opacity-30" />
    </button>
  )
}

// Status inline editor
function StatusCell({ item, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.status)

  const save = () => {
    onUpdate(item.id, { status: value })
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <select value={value} onChange={e => setValue(e.target.value)}
          className="text-xs border border-zinc-200 rounded px-1.5 py-0.5 bg-white"
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={save} className="text-emerald-500 hover:text-emerald-700"><Check size={14} /></button>
        <button onClick={() => setEditing(false)} className="text-zinc-400 hover:text-zinc-600"><X size={14} /></button>
      </span>
    )
  }

  return (
    <button onClick={() => setEditing(true)}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium cursor-pointer hover:ring-1 ring-zinc-300 transition-all ${STATUS_COLORS[value] || 'bg-zinc-100 text-zinc-500'}`}
    >
      {value}
      <Edit3 size={10} className="opacity-50" />
    </button>
  )
}

export default function Items() {
  const [items, setItems] = useState([])
  const [overview, setOverview] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [filterOptions, setFilterOptions] = useState({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const params = { page, page_size: 200, ...filters }
    if (search) params.search = search
    const [data, ov] = await Promise.all([api.items(params), api.overview()])
    setItems(data.items)
    setTotal(data.total)
    setOverview(ov)
    setLoading(false)
  }, [page, filters, search])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { api.filterOptions().then(setFilterOptions) }, [])

  // 页面切回时自动刷新
  useEffect(() => {
    const reload = () => fetchItems()
    const onVisible = () => { if (document.visibilityState === 'visible') fetchItems() }
    window.addEventListener('pageshow', reload)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pageshow', reload)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchItems])

  const updateItem = async (id, data) => {
    await api.updateItem(id, data)
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
  }

  const clearFilters = () => { setFilters({}); setSearch(''); setPage(1) }

  // 汇总统计 - 使用 API 总预算
  const apiTotalBudget = overview?.total_budget || 0
  const totalActual = items.reduce((s, i) => s + (i.actual_cost || 0), 0)
  const apiBudgetRemaining = apiTotalBudget - totalActual
  const itemsWithActual = items.filter(i => i.actual_cost > 0).length

  const FilterSelect = ({ label, field }) => (
    <select
      value={filters[field] || ''}
      onChange={e => { setFilters(f => ({ ...f, [field]: e.target.value || undefined })); setPage(1) }}
      className="text-xs border border-zinc-200 rounded-md px-2 py-1.5 bg-white text-zinc-600"
    >
      <option value="">全部{label}</option>
      {(filterOptions[field + 's'] || []).map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800">采购清单</h2>
          <p className="text-sm text-zinc-500 mt-1">
            共 {total} 项 · {items.filter(i => i.status !== '未开始').length} 项已启动
            {itemsWithActual > 0 && ` · ${itemsWithActual} 项已录入实际花费`}
          </p>
        </div>
        <button
          onClick={async () => {
            const token = localStorage.getItem('house_token') || ''
            const resp = await fetch('/api/export/excel', { headers: { Authorization: `Bearer ${token}` } })
            if (!resp.ok) return alert('下载失败，请先导入 Excel')
            const blob = await resp.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = '装修预算_最新.xlsx'; a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
        >
          <Download size={16} />
          导出 Excel
        </button>
      </div>

      {/* Budget vs Actual summary bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3 shadow-sm border border-zinc-100 text-center">
          <div className="text-xs text-zinc-400 mb-1">预算总额</div>
          <div className="text-lg font-bold text-zinc-700">{formatMoney(apiTotalBudget)}</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-zinc-100 text-center">
          <div className="text-xs text-zinc-400 mb-1">实际花费</div>
          <div className={`text-lg font-bold ${totalActual > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>
            {totalActual > 0 ? formatMoney(totalActual) : '待录入'}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-zinc-100 text-center">
          <div className="text-xs text-zinc-400 mb-1">预算余额</div>
          <div className={`text-lg font-bold flex items-center justify-center gap-1 ${
            apiBudgetRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {apiBudgetRemaining >= 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            {formatMoney(Math.abs(apiBudgetRemaining))}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-zinc-100 text-center">
          <div className="text-xs text-zinc-400 mb-1">花费占比</div>
          <div className={`text-lg font-bold ${totalActual > 0 ? 'text-indigo-600' : 'text-zinc-400'}`}>
            {totalActual > 0 ? `${((totalActual / apiTotalBudget) * 100).toFixed(1)}%` : '-'}
          </div>
        </div>
      </div>

      {/* Search & filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="搜索采购项、品牌、备注..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all ${
              showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Filter size={16} />
            筛选
            <ChevronDown size={14} className={showFilters ? 'rotate-180' : ''} />
          </button>
          <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700">
            <RotateCcw size={14} /> 重置
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100">
            <FilterSelect label="状态" field="status" />
            <FilterSelect label="优先级" field="priority" />
            <FilterSelect label="大项" field="category" />
            <FilterSelect label="阶段" field="phase" />
            <FilterSelect label="属性" field="attr" />
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-zinc-400">加载中...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
          <div className="table-wrapper">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50 text-left">
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium">采购项</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium">空间</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium">大项</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium text-right">预算</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium text-right">实际花费</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium text-right">差额</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium">阶段</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium">优先级</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium">状态</th>
                  <th className="px-3 py-3 text-xs text-zinc-400 uppercase font-medium">品牌推荐</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const variance = formatVariance(item.control_budget, item.actual_cost)
                  return (
                    <tr key={item.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-zinc-800 text-xs">{item.item_name}</div>
                        {item.notes && <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[240px]">{item.notes}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500">{item.floor_space}</td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500">{item.category}</td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        <span className="text-zinc-700 font-medium">{formatMoney(item.control_budget)}</span>
                        <div className="text-[10px] text-zinc-400">{formatMoney(item.budget_min)} ~ {formatMoney(item.budget_max)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        <EditableNumber
                          value={item.actual_cost}
                          onSave={v => updateItem(item.id, { actual_cost: v })}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        {variance ? (
                          variance.diff === 0 ? (
                            <span className="text-zinc-400">持平</span>
                          ) : variance.over ? (
                            <span className="inline-flex items-center gap-1 font-bold text-red-500">
                              <TrendingUp size={12} />超 {formatMoney(variance.abs)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-500">
                              <TrendingDown size={12} />省 {formatMoney(variance.abs)}
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500">{item.phase}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] rounded-full font-medium ${PRIORITY_COLORS[item.priority] || 'bg-zinc-100 text-zinc-500'}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusCell item={item} onUpdate={updateItem} />
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-zinc-400 max-w-[140px] truncate">{item.brand_recommendation}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
