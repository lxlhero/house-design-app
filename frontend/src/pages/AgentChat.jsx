import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, Trash2, Mic, MicOff, Plus, MessageSquare, ChevronLeft } from 'lucide-react'

const STORE_KEY = 'house_agent_sessions'

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]') }
  catch { return [] }
}
function saveSessions(ss) {
  localStorage.setItem(STORE_KEY, JSON.stringify(ss))
}

// 用 AI 生成会话标题
async function generateSessionTitle(text, sessionId, setSessions) {
  try {
    const token = localStorage.getItem('house_token') || ''
    const resp = await fetch('/api/agent/title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: text }),
    })
    if (resp.ok) {
      const { title } = await resp.json()
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s))
    }
  } catch {}
}

// ═══ 语音识别 ═══
function useSpeech(setInput) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recRef = useRef(null)
  const manualStop = useRef(false)  // 区分手动停止 vs 超时
  const finalText = useRef('')      // 累积最终识别结果

  const createRec = () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!R) return null
    const r = new R()
    r.lang = 'zh-CN'
    r.interimResults = true
    r.continuous = true             // 持续监听，不会说完一句就停
    // Safari 默认 5-8s 静默超时，通过重启解决
    r.onresult = e => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          final += t
        } else {
          interim += t
        }
      }
      if (final) finalText.current += final
      setInput(finalText.current + interim)
    }
    r.onend = () => {
      // 手动停止 → 不重启
      if (manualStop.current) {
        setListening(false)
        return
      }
      // 超时/自动停止 → 重启识别
      try { recRef.current?.start() } catch {}
    }
    r.onerror = (e) => {
      // 'no-speech' 或 'aborted' 不提示，静默重试
      if (e.error === 'aborted' || e.error === 'no-speech') {
        if (!manualStop.current) {
          try { recRef.current?.start() } catch {}
        }
        return
      }
      setListening(false)
    }
    return r
  }

  useEffect(() => {
    const r = createRec()
    if (r) {
      setSupported(true)
      recRef.current = r
    }
    return () => {
      manualStop.current = true
      try { recRef.current?.stop() } catch {}
    }
  }, [])

  const toggle = useCallback(() => {
    if (!recRef.current) return
    if (listening) {
      manualStop.current = true
      recRef.current.stop()
      setListening(false)
    } else {
      finalText.current = ''
      manualStop.current = false
      setListening(true)
      try { recRef.current.start() } catch {}
    }
  }, [listening])

  return { listening, supported, toggle }
}

export default function AgentChat() {
  const [sessions, setSessions] = useState(() => loadSessions())
  const [activeId, setActiveId] = useState(() => sessions[0]?.id || null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEnd = useRef(null)
  const inputRef = useRef(null)
  const { listening, supported, toggle: toggleMic } = useSpeech(setInput)

  const active = sessions.find(s => s.id === activeId) || null
  const messages = active?.messages || []

  useEffect(() => { saveSessions(sessions) }, [sessions])
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const updateActive = (fn) => {
    setSessions(prev => prev.map(s => s.id === activeId ? fn(s) : s))
  }

  const newSession = () => {
    const s = { id: Date.now().toString(36), title: '新对话', messages: [], createdAt: Date.now() }
    setSessions(prev => [s, ...prev])
    setActiveId(s.id)
    setSidebarOpen(false)
    inputRef.current?.focus()
  }

  const deleteSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    if (id === activeId) {
      const remaining = sessions.filter(s => s.id !== id)
      setActiveId(remaining[0]?.id || null)
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || streaming || !activeId) return
    setInput(''); setError(null)

    const userMsg = { role: 'user', content: text }
    const agentMsg = { role: 'assistant', content: '' }
    updateActive(s => ({
      ...s,
      messages: [...s.messages, userMsg, agentMsg],
      title: s.messages.length === 0 ? text.slice(0, 20) : s.title,
    }))
    // 首条消息 → 后台生成标题
    if (messages.length === 0) {
      generateSessionTitle(text, activeId, setSessions)
    }
    setStreaming(true)

    try {
      const token = localStorage.getItem('house_token') || ''
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const resp = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, history }),
      })
      if (!resp.ok) throw new Error(`AI 服务异常 (${resp.status})`)

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const ln of lines) {
          if (!ln.startsWith('data: ')) continue
          const d = ln.slice(6)
          if (d === '[DONE]') break
          try {
            const p = JSON.parse(d)
            if (p.error) setError(p.error)
            else if (p.tool) {
              // 工具执行反馈：在助手消息末尾追加一行提示
              const toolEmoji = { search_items: '🔍', update_item_budget: '💰', update_item_status: '📋', update_item_supplier: '📝', get_budget_summary: '📊', get_phase_status: '📅', update_total_budget: '💵' }
              updateActive(s => {
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === 'assistant') {
                  last.content += `\n\n${toolEmoji[p.tool] || '⚙️'} 已执行操作`
                }
                return { ...s, messages: msgs }
              })
            }
            else if (p.text) {
              updateActive(s => {
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === 'assistant') last.content += p.text
                return { ...s, messages: msgs }
              })
            }
          } catch {}
        }
      }
    } catch (e) {
      setError(e.message)
    }
    setStreaming(false)
  }

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-4 md:-m-6 lg:-m-8">
      {/* ═══ 会话列表侧栏 ═══ */}
      <div className={`${sidebarOpen ? 'w-56' : 'w-0'} transition-all duration-200 overflow-hidden border-r border-zinc-100 flex-shrink-0 bg-zinc-50/50`}>
        <div className="w-56 p-3">
          <button onClick={newSession}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors mb-3">
            <Plus size={16} /> 新对话
          </button>
          <div className="space-y-0.5">
            {sessions.map(s => (
              <div key={s.id}
                onClick={() => { setActiveId(s.id); setSidebarOpen(false) }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  s.id === activeId ? 'bg-white shadow-sm border border-zinc-200' : 'hover:bg-white/60 text-zinc-600'
                }`}>
                <MessageSquare size={14} className="flex-shrink-0 text-zinc-400" />
                <span className="truncate flex-1">{s.title}</span>
                <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-all">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 主对话区 ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 flex-shrink-0">
          <button onClick={() => setSidebarOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
            <ChevronLeft size={18} className={`transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-800 truncate">{active?.title || 'Hermes'}</h2>
            <p className="text-[11px] text-zinc-400">{sessions.length} 个会话</p>
          </div>
        </div>

        {/* 消息 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">👋</div>
              <p className="text-sm text-zinc-500 mb-2">你好！我是装修管家小美 🏠</p>
              <p className="text-xs text-zinc-400">问我预算、进度、下一步...</p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {['现在该做什么？', '预算还够吗？', '推荐智能家居', '什么时候定橱柜？'].map(q => (
                  <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">{q}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-indigo-500 text-white rounded-br-md' : 'bg-white border border-zinc-100 text-zinc-700 rounded-bl-md shadow-sm'
              }`}>
                {m.content || (streaming && i === messages.length - 1 ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : '')}
              </div>
            </div>
          ))}
          {error && <div className="text-center"><span className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-full">{error}</span></div>}
          <div ref={messagesEnd} />
        </div>

        {/* 输入 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey} disabled={streaming}
              placeholder={listening ? "正在聆听…" : "输入问题，Enter 发送…"}
              className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-zinc-50 transition-all"
              autoFocus
            />
            {supported && (
              <button onClick={toggleMic}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                  listening ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}>
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <button onClick={sendMessage} disabled={!input.trim() || streaming}
              className="w-11 h-11 rounded-xl bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 disabled:opacity-40 transition-all flex-shrink-0">
              <Send size={18} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-400 mt-1.5 text-center">Hermes · 可创建多个独立对话</p>
        </div>
      </div>
    </div>
  )
}
