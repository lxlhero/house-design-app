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
      if (!res.ok) { setError(data.detail || '登录失败'); return }
      localStorage.setItem('house_token', data.token)
      navigate('/', { replace: true })
    } catch { setError('网络错误，请稍后重试') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-lg"
      style={{
        background: 'linear-gradient(160deg, #F2F2F4 0%, #EDEDEF 40%, #E8E8EC 100%)',
      }}>
      <div className="w-full max-w-md animate-in">
        {/* 品牌 */}
        <div className="text-center mb-3xl">
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl mb-xl"
            style={{
              background: 'linear-gradient(135deg, #0066CC 0%, #409CFF 100%)',
              boxShadow: '0 8px 32px 0 rgba(0,102,204,0.25)',
            }}>
            <span className="text-3xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>🏠</span>
          </div>
          <h1 className="text-hero font-bold text-text tracking-tight"
            style={{ letterSpacing: 'var(--text-hero--letter-spacing)', lineHeight: 'var(--text-hero--line-height)' }}>
            装修管家
          </h1>
          <p className="text-callout text-text-secondary mt-sm">嘉兴别墅装修管理系统</p>
        </div>

        {/* 登录卡片 */}
        <div className="glass-card p-2xl animate-in animate-in-delay-1">
          <form onSubmit={handleLogin} className="space-y-xl">
            <div>
              <label className="block text-label text-text-secondary uppercase tracking-wider mb-sm">
                用户名
              </label>
              <input
                type="text" value={username} autoFocus
                onChange={e => setUsername(e.target.value)}
                className="input-premium" placeholder="输入用户名"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-label text-text-secondary uppercase tracking-wider mb-sm">
                密码
              </label>
              <input
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-premium" placeholder="输入密码"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-sm px-md py-sm rounded-lg text-caption font-medium"
                style={{ background: 'rgba(255,59,48,0.06)', color: '#FF3B30' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 4v4M7 10h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !username || !password}
              className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center gap-sm">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/>
                  </svg>
                  登录中…
                </span>
              ) : '登录'}
            </button>
          </form>
        </div>

        <p className="text-caption text-text-tertiary text-center mt-xl">
          嘉兴 · 五层别墅装修管理 · v2.0
        </p>
      </div>
    </div>
  )
}
