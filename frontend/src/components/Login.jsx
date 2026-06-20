import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || '登录失败')
        return
      }
      localStorage.setItem('house_token', data.token)
      navigate('/', { replace: true })
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-lg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-full max-w-sm">
        {/* 品牌区 */}
        <div className="text-center mb-xxl">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue/10 mb-lg">
            <span className="text-4xl">🏠</span>
          </div>
          <h1 className="text-large-title font-bold text-label tracking-tight">装修管家</h1>
          <p className="text-callout text-secondary-label mt-xs">嘉兴别墅装修管理系统</p>
        </div>

        {/* 登录卡片 */}
        <form onSubmit={handleLogin} className="apple-card p-xl space-y-lg">
          <div>
            <label className="block text-caption font-semibold text-secondary-label mb-sm uppercase tracking-wider">用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="apple-input w-full"
              placeholder="输入用户名"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-caption font-semibold text-secondary-label mb-sm uppercase tracking-wider">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="apple-input w-full"
              placeholder="输入密码"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-footnote text-red bg-red/10 px-md py-sm rounded-md">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="apple-btn-primary w-full mt-sm"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="text-caption text-tertiary-label text-center mt-xl">
          嘉兴 · 五层别墅装修管理
        </p>
      </div>
    </div>
  )
}
