import { useState, useEffect } from 'react'
import { api } from '../api'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Clock } from 'lucide-react'

export default function Import() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])

  useEffect(() => { api.importLogs().then(setLogs).catch(() => {}) }, [])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setResult(null); setError(null)
    try {
      const res = await api.importExcel(file)
      if (res.error) { setError(res.error) }
      else { setResult(res); const l = await api.importLogs(); setLogs(l) }
    } catch (e) { setError(`上传失败: ${e.message}`) }
    setUploading(false)
  }

  return (
    <div className="space-y-7 max-w-[768px] animate-in">
      {/* 标题 */}
      <div>
        <p className="text-label text-text-secondary uppercase tracking-wider mb-sm">数据管理</p>
        <h1 className="text-hero font-bold text-text tracking-tight"
          style={{ letterSpacing: 'var(--text-hero--letter-spacing)', lineHeight: 'var(--text-hero--line-height)' }}>
          导入数据
        </h1>
        <p className="text-callout text-text-secondary mt-sm">
          上传新版 Excel 全量替换数据库（Excel 为唯一真理源）
        </p>
      </div>

      {/* 上传区域 */}
      <div className="glass-card-static p-2xl">
        <div className="border-2 border-dashed rounded-2xl p-2xl text-center transition-colors"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <FileSpreadsheet size={44} className="mx-auto mb-lg" style={{ color: '#C7C7CC' }} strokeWidth={1.5} />
          <p className="text-callout text-text-secondary font-medium mb-sm">拖拽或点击上传 Excel 文件</p>
          <p className="text-caption text-text-tertiary mb-lg">支持 .xlsx / .xls 格式 · 与原始表格相同结构</p>
          <label className="btn-primary cursor-pointer inline-flex">
            <Upload size={16} strokeWidth={2} />
            <span className="ml-sm">选择文件</span>
            <input type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { setFile(e.target.files[0]); setResult(null); setError(null) }} />
          </label>
          {file && (
            <p className="text-callout font-medium mt-lg" style={{ color: '#0066CC' }}>
              已选择: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {file && (
          <button onClick={handleUpload} disabled={uploading}
            className="btn-primary w-full mt-lg">
            {uploading ? '导入中…' : '开始导入'}
          </button>
        )}
      </div>

      {/* 结果 */}
      {result && (
        <div className="glass-card-static p-xl animate-in"
          style={{ borderColor: 'rgba(52,199,89,0.2)', background: 'rgba(52,199,89,0.04)' }}>
          <div className="flex items-center gap-sm mb-lg">
            <CheckCircle size={18} style={{ color: '#34C759' }} strokeWidth={2} />
            <span className="text-heading font-semibold" style={{ color: '#248A3D' }}>全量替换完成</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            {[
              { label: '采购项', value: result.summary.items_count || 0, color: '#0066CC' },
              { label: '预算大项', value: result.summary.categories_count || 0, color: '#AF52DE' },
              { label: '装修阶段', value: result.summary.phases_count || 0, color: '#FF9500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center py-lg rounded-xl" style={{ background: 'rgba(255,255,255,0.8)' }}>
                <div className="stat-number" style={{ color }}>{value}</div>
                <p className="text-label text-text-tertiary mt-xs">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-caption text-text-tertiary mt-md">文件名: {result.filename} · 模式: {result.mode}</p>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="flex items-center gap-sm px-lg py-md rounded-xl animate-in"
          style={{ background: 'rgba(255,59,48,0.06)', border: '0.5px solid rgba(255,59,48,0.15)' }}>
          <AlertCircle size={16} style={{ color: '#FF3B30' }} />
          <span className="text-callout font-medium" style={{ color: '#FF3B30' }}>{error}</span>
        </div>
      )}

      {/* 导入历史 */}
      <div className="glass-card-static overflow-hidden">
        <div className="px-xl py-lg flex items-center gap-sm" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
          <Clock size={16} strokeWidth={1.8} className="text-text-secondary" />
          <h3 className="text-heading font-semibold text-text tracking-tight">导入历史</h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-2xl text-center text-callout text-text-tertiary">暂无导入记录</div>
        ) : (
          <table className="table-premium">
            <thead><tr>
              <th>文件名</th><th>新增</th><th>更新</th><th>未变</th><th>时间</th>
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td>{l.filename}</td>
                  <td style={{ color: '#34C759' }}>{l.items_created}</td>
                  <td style={{ color: '#0066CC' }}>{l.items_updated}</td>
                  <td className="text-text-tertiary">{l.items_unchanged}</td>
                  <td className="text-caption text-text-tertiary">{l.imported_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 说明 */}
      <div className="px-xl py-lg rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '0.5px solid rgba(0,0,0,0.04)' }}>
        <h3 className="text-subhead font-semibold text-text mb-sm">📖 使用说明</h3>
        <ul className="text-caption text-text-secondary space-y-1.5">
          <li>• 上传的 Excel 需要包含以下 Sheet：<strong>预算总览、采购清单、装修阶段顺序、楼层预算</strong></li>
          <li>• 系统按采购项名称匹配已存在的记录，相同名称会<strong>更新</strong>，新出现会<strong>新增</strong></li>
          <li>• 已手动修改的状态、实际花费等不会被覆盖</li>
          <li>• 新版 Excel 有新预算/新阶段时直接上传即可批量更新</li>
        </ul>
      </div>
    </div>
  )
}
