import { useState, useEffect } from 'react'
import { api } from '../api'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Clock, Download, History } from 'lucide-react'

export default function Import() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [historyFiles, setHistoryFiles] = useState([])

  useEffect(() => { api.importLogs().then(setLogs).catch(() => {}) }, [])
  useEffect(() => { api.excelHistory().then(setHistoryFiles).catch(() => {}) }, [])

  const refreshHistory = () => {
    api.excelHistory().then(setHistoryFiles).catch(() => {})
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)
    setError(null)
    try {
      const res = await api.importExcel(file)
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res)
        const newLogs = await api.importLogs().catch(() => [])
        setLogs(newLogs)
        refreshHistory()
      }
    } catch (e) {
      setError(`上传失败: ${e.message}`)
    }
    setUploading(false)
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0 KB'
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-800">导入数据</h2>
          <button onClick={async () => {
            const token = localStorage.getItem('house_token') || ''
            const resp = await fetch('/api/export/excel', { headers: { Authorization: `Bearer ${token}` } })
            if (!resp.ok) return alert('下载失败，请先导入 Excel')
            const blob = await resp.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = '装修预算_最新.xlsx'; a.click()
            URL.revokeObjectURL(url)
          }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors">
            <Download size={16} />
            下载最新 Excel
          </button>
        </div>
        <p className="text-sm text-zinc-500 mt-1">上传新版 Excel 全量替换数据库（清空 → 重新导入，Excel 为唯一真相源）</p>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-zinc-100">
        <div className="border-2 border-dashed border-zinc-200 rounded-xl p-10 text-center hover:border-indigo-300 transition-colors">
          <FileSpreadsheet size={48} className="mx-auto text-zinc-300 mb-4" />
          <p className="text-sm text-zinc-600 font-medium mb-2">
            拖拽或点击上传 Excel 文件
          </p>
          <p className="text-xs text-zinc-400 mb-4">
            支持 .xlsx / .xls 格式 · 与原始表格相同结构
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg cursor-pointer hover:bg-indigo-600 transition-colors">
            <Upload size={16} />
            选择文件
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { setFile(e.target.files[0]); setResult(null); setError(null) }}
            />
          </label>
          {file && (
            <p className="text-sm text-indigo-600 mt-3 font-medium">
              已选择: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-5 w-full py-2.5 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? '导入中...' : '开始导入'}
          </button>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-emerald-500" />
            <span className="font-semibold text-emerald-700">全量替换完成</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-indigo-600">{result.summary.items_count || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">采购项</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-violet-600">{result.summary.categories_count || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">预算大项</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{result.summary.phases_count || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">装修阶段</div>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-3">文件名: {result.filename} · 模式: {result.mode}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-2">
          <AlertCircle size={18} className="text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Historical Excel versions */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
            <History size={16} /> 历史 Excel 版本
          </h3>
        </div>
        {historyFiles.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">暂无历史版本（导入 Excel 后会自动保存）</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50 text-left text-xs text-zinc-400 uppercase">
                <th className="px-5 py-3">文件名</th>
                <th className="px-5 py-3">大小</th>
                <th className="px-5 py-3">保存时间</th>
                <th className="px-5 py-3 w-16">操作</th>
              </tr>
            </thead>
            <tbody>
              {historyFiles.map(f => (
                <tr key={f.filename} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  <td className="px-5 py-3 text-zinc-700 font-mono text-xs">{f.filename}</td>
                  <td className="px-5 py-3 text-zinc-500">{formatSize(f.size)}</td>
                  <td className="px-5 py-3 text-zinc-400 text-xs">{formatTime(f.created_at)}</td>
                  <td className="px-5 py-3">
                    <a
                      href={api.downloadHistoryExcel(f.filename)}
                      className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-700 text-xs font-medium transition-colors"
                    >
                      <Download size={14} />
                      下载
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Import history */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
            <Clock size={16} /> 导入历史
          </h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">暂无导入记录</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50 text-left text-xs text-zinc-400 uppercase">
                <th className="px-5 py-3">文件名</th>
                <th className="px-5 py-3">新增</th>
                <th className="px-5 py-3">更新</th>
                <th className="px-5 py-3">未变</th>
                <th className="px-5 py-3">时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-zinc-50">
                  <td className="px-5 py-3 text-zinc-700">{l.filename}</td>
                  <td className="px-5 py-3 text-emerald-600">{l.items_created}</td>
                  <td className="px-5 py-3 text-blue-600">{l.items_updated}</td>
                  <td className="px-5 py-3 text-zinc-400">{l.items_unchanged}</td>
                  <td className="px-5 py-3 text-zinc-400 text-xs">{l.imported_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-700 mb-2">📖 使用说明</h3>
        <ul className="text-xs text-zinc-500 space-y-1.5">
          <li>• 上传的 Excel 需要包含以下 Sheet：<strong>预算总览、采购清单、装修阶段顺序、楼层预算</strong></li>
          <li>• 系统按采购项名称匹配已存在的记录，相同名称的会<strong>更新</strong>，新出现的会<strong>新增</strong></li>
          <li>• 已有数据中你手动修改的状态、实际花费等不会被覆盖</li>
          <li>• 当新版 Excel 有新预算、新阶段时，直接上传即可批量更新</li>
          <li>• 每次导入会自动保存历史版本，可在上方「历史 Excel 版本」中下载</li>
        </ul>
      </div>
    </div>
  )
}
