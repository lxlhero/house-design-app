import { useState, useEffect } from 'react'
import { RotateCcw, Save, AlertTriangle, Tag, Sparkles } from 'lucide-react'

function authedFetch(url, options = {}) {
  const token = localStorage.getItem('house_token') || ''
  return fetch(url, { ...options, headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }})
}

export default function Versions() {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rollingBack, setRollingBack] = useState(null)
  const [showConfirm, setShowConfirm] = useState(null)
  const [message, setMessage] = useState(null)

  const fetchVersions = async () => {
    try {
      const resp = await authedFetch('/api/versions')
      if (!resp.ok) throw new Error(`服务器错误 (${resp.status})`)
      setVersions(await resp.json()); setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchVersions() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const resp = await authedFetch('/api/versions/save', { method: 'POST', body: '{}' })
      const data = await resp.json()
      setMessage({ type: resp.ok ? 'success' : 'error', text: resp.ok ? '版本保存成功' : (data.detail || '保存失败') })
      if (resp.ok) await fetchVersions()
    } catch { setMessage({ type: 'error', text: '保存失败' }) }
    setSaving(false); setTimeout(() => setMessage(null), 3000)
  }

  const handleRollback = async (versionId) => {
    setRollingBack(versionId); setShowConfirm(null)
    try {
      const resp = await authedFetch(`/api/versions/rollback/${versionId}`, { method: 'POST' })
      const data = await resp.json()
      if (resp.ok) { setMessage({ type: 'success', text: data.message || '回退成功' }); setTimeout(() => window.location.reload(), 1500) }
      else setMessage({ type: 'error', text: data.detail || '回退失败' })
    } catch { setMessage({ type: 'error', text: '回退失败' }) }
    setRollingBack(null); setTimeout(() => setMessage(null), 4000)
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center py-3xl gap-lg animate-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl bg-red/8">😞</div>
      <p className="text-callout text-text-secondary">{error}</p>
      <button onClick={fetchVersions} className="btn-secondary">重试</button>
    </div>
  )

  if (loading) return (
    <div className="space-y-7 animate-in">
      <div className="skeleton h-8 w-40 rounded-lg" />
      <div className="skeleton h-5 w-64 rounded-lg" />
      {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="space-y-7 max-w-2xl animate-in">
      {/* 标题 */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <p className="text-label text-text-secondary uppercase tracking-wider mb-sm">系统管理</p>
          <h1 className="text-hero font-bold text-text tracking-tight"
            style={{ letterSpacing: 'var(--text-hero--letter-spacing)', lineHeight: 'var(--text-hero--line-height)' }}>
            版本管理
          </h1>
          <p className="text-callout text-text-secondary mt-sm">数据快照 · 可回退到任意版本</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save size={16} strokeWidth={2} />
          <span className="ml-sm">{saving ? '保存中…' : '保存当前数据'}</span>
        </button>
      </div>

      {/* 消息 */}
      {message && (
        <div className={`flex items-center gap-sm px-lg py-md rounded-xl text-callout font-medium animate-in ${
          message.type === 'success' ? 'badge-success' : 'badge-danger'
        }`} style={message.type === 'success'
          ? { background: 'rgba(52,199,89,0.08)', color: '#248A3D', border: '0.5px solid rgba(52,199,89,0.15)' }
          : { background: 'rgba(255,59,48,0.06)', color: '#FF3B30', border: '0.5px solid rgba(255,59,48,0.15)' }
        }>
          {message.text}
        </div>
      )}

      {/* 版本列表 */}
      <div className="space-y-4">
        {versions.map((v, i) => {
          const isLatest = i === 0
          const hasSnapshot = !!v.snapshot_id
          const features = v.features?.split('\n').filter(f => f.trim()) || []

          return (
            <div key={v.id} className="glass-card-static overflow-hidden">
              <div className="flex items-center justify-between px-xl py-lg flex-wrap gap-md"
                style={{ borderBottom: '0.5px solid rgba(0,0,0,0.04)', background: isLatest ? 'rgba(0,102,204,0.02)' : 'transparent' }}>
                <div className="flex items-center gap-md">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={isLatest
                      ? { background: 'linear-gradient(135deg, #0066CC, #409CFF)', color: 'white', boxShadow: '0 4px 12px rgba(0,102,204,0.2)' }
                      : { background: 'rgba(0,0,0,0.04)', color: '#AEAEB2' }}>
                    <Tag size={15} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-sm">
                      <span className="text-callout font-semibold text-text">{v.version}</span>
                      {isLatest && (
                        <span className="badge badge-accent">
                          <Sparkles size={10} /> 当前版本
                        </span>
                      )}
                    </div>
                    <span className="text-caption text-text-secondary">{v.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-sm">
                  {!hasSnapshot && !isLatest && <span className="text-caption text-text-tertiary">暂无快照</span>}
                  {!hasSnapshot && isLatest && <span className="text-caption" style={{ color: '#FF9500' }}>点击保存以创建快照</span>}
                  {hasSnapshot && !isLatest && (
                    <button onClick={() => setShowConfirm(v.id)} disabled={rollingBack === v.id}
                      className="btn-ghost" style={{ color: '#FF9500' }}>
                      <RotateCcw size={14} strokeWidth={2} /> 回退到此版本
                    </button>
                  )}
                </div>
              </div>

              {features.length > 0 && (
                <div className="px-xl py-lg">
                  <ul className="space-y-1.5">
                    {features.map((f, j) => (
                      <li key={j} className="text-caption text-text-secondary flex items-start gap-sm">
                        <span style={{ color: '#0066CC' }}>•</span>
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

      {/* 确认弹窗 */}
      {showConfirm && (() => {
        const v = versions.find(x => x.id === showConfirm)
        return (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-lg"
            onClick={() => setShowConfirm(null)}>
            <div className="glass-card p-2xl max-w-sm w-full animate-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-md mb-lg">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,149,0,0.12)' }}>
                  <AlertTriangle size={20} style={{ color: '#FF9500' }} />
                </div>
                <div>
                  <h3 className="text-heading font-semibold text-text">确认回退</h3>
                  <p className="text-caption text-text-secondary">恢复到 {v?.version}（{v?.title}）</p>
                </div>
              </div>
              <p className="text-caption text-text-secondary mb-lg">
                此操作将把数据恢复到该版本发布时的状态。当前所有修改将丢失。
              </p>
              <div className="flex gap-sm justify-end">
                <button onClick={() => setShowConfirm(null)} className="btn-secondary">取消</button>
                <button onClick={() => handleRollback(showConfirm)}
                  className="btn-primary" style={{ background: '#FF9500' }}>确认回退</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 说明 */}
      <div className="px-xl py-lg rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '0.5px solid rgba(0,0,0,0.04)' }}>
        <h3 className="text-subhead font-semibold text-text mb-sm">📖 使用说明</h3>
        <ul className="text-caption text-text-secondary space-y-1.5">
          <li>• <strong>保存数据</strong>：为当前数据创建快照备份</li>
          <li>• <strong>回退</strong>：恢复到历史版本（需先保存过快照）</li>
          <li>• <strong>安全</strong>：回退前需确认，防止误操作</li>
        </ul>
      </div>
    </div>
  )
}
