import { useState, useEffect } from 'react'
import { RotateCcw, Save, AlertTriangle, Check, Tag, Sparkles } from 'lucide-react'

export default function Versions() {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [rollingBack, setRollingBack] = useState(null)
  const [showConfirm, setShowConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const fetchVersions = async () => {
    const resp = await fetch('/api/versions')
    setVersions(await resp.json())
    setLoading(false)
  }

  useEffect(() => { fetchVersions() }, [])

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/versions/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setMessage({ type: 'success', text: '版本保存成功' })
    await fetchVersions()
    setSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  const handleRollback = async (versionId) => {
    setRollingBack(versionId)
    setShowConfirm(null)
    try {
      const resp = await fetch(`/api/versions/rollback/${versionId}`, { method: 'POST' })
      const data = await resp.json()
      if (data.ok) {
        setMessage({ type: 'success', text: data.message })
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setMessage({ type: 'error', text: data.detail || '回退失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '回退失败，请重试' })
    }
    setRollingBack(null)
    setTimeout(() => setMessage(null), 4000)
  }

  if (loading) return <div className="flex items-center justify-center h-96 text-zinc-400">加载中...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800">版本管理</h2>
          <p className="text-sm text-zinc-500 mt-1">平台更新历史 · 可回退到任意版本的数据状态</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save size={16} />
          {saving ? '保存中...' : '保存当前数据'}
        </button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <Check size={16} />
          {message.text}
        </div>
      )}

      {/* Version timeline */}
      <div className="space-y-4">
        {versions.map((v, i) => {
          const isLatest = i === 0
          const hasSnapshot = !!v.snapshot_id
          const features = v.features?.split('\n').filter(f => f.trim()) || []

          return (
            <div key={v.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
              isLatest ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-zinc-100'
            }`}>
              {/* Version header */}
              <div className="flex items-center justify-between px-5 py-4 bg-zinc-50/50 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isLatest ? 'bg-indigo-500 text-white' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    <Tag size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-800">{v.version}</span>
                      {isLatest && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                          <Sparkles size={10} /> 当前版本
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500">{v.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!hasSnapshot && !isLatest && (
                    <span className="text-[10px] text-zinc-400">暂无数据快照</span>
                  )}
                  {!hasSnapshot && isLatest && (
                    <span className="text-[10px] text-amber-500">点击上方保存以创建快照</span>
                  )}
                  {hasSnapshot && !isLatest && (
                    <button
                      onClick={() => setShowConfirm(v.id)}
                      disabled={rollingBack === v.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <RotateCcw size={14} />
                      回退到此版本
                    </button>
                  )}
                </div>
              </div>

              {/* Features list */}
              {features.length > 0 && (
                <div className="px-5 py-4">
                  <ul className="space-y-1.5">
                    {features.map((f, j) => (
                      <li key={j} className="text-xs text-zinc-600 flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        {f.replace(/^•\s*/, '')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Rollback confirmation modal */}
      {showConfirm && (() => {
        const v = versions.find(v => v.id === showConfirm)
        return (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowConfirm(null)}>
            <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-800">确认回退</h3>
                  <p className="text-sm text-zinc-500">恢复到 {v?.version}（{v?.title}）</p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 mb-5">
                此操作将把数据恢复到该版本发布时的状态。当前所有修改将丢失。
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                >取消</button>
                <button onClick={() => handleRollback(showConfirm)}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                >确认回退</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Help */}
      <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-700 mb-2">📖 使用说明</h3>
        <ul className="text-xs text-zinc-500 space-y-1.5">
          <li>• <strong>保存数据</strong>：点击"保存当前数据"为当前平台版本创建数据快照</li>
          <li>• <strong>回退</strong>：点击历史版本旁的"回退到此版本"恢复数据（需先保存过快照）</li>
          <li>• <strong>安全</strong>：回退前弹窗确认，防止误操作</li>
          <li>• <strong>提示</strong>：新版本升级后记得先保存数据，这样不满意才能回退</li>
        </ul>
      </div>
    </div>
  )
}
