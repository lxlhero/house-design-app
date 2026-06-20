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
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 safe-area-inset">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-zinc-800">装修管家</h1>
          <p className="text-sm text-zinc-500 mt-1">嘉兴别墅装修管理</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg border border-zinc-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 text-base focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="输入用户名"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 text-base focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="输入密码"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
