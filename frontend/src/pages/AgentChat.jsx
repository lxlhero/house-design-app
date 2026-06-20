import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, Trash2, Mic, MicOff } from 'lucide-react'

const STORAGE_KEY = 'house_agent_history'

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}
function saveHistory(h) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(-50)))
}

// ═══ 语音识别 Hook ═══
function useSpeech(setInput) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSupported(true)
      const rec = new SpeechRecognition()
      rec.lang = 'zh-CN'
      rec.interimResults = true
      rec.continuous = false
      rec.onresult = (e) => {
        let text = ''
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript
        }
        setInput(text)
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recognitionRef.current = rec
    }
  }, [])

  const toggle = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    if (listening) {
      rec.stop()
    } else {
      setListening(true)
      rec.start()
    }
  }, [listening])

  return { listening, supported, toggle }
}

export default function AgentChat() {
  const [messages, setMessages] = useState(() => loadHistory())
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const messagesEnd = useRef(null)
  const inputRef = useRef(null)
  const { listening, supported, toggle: toggleMic } = useSpeech(setInput)

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { saveHistory(messages) }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setError(null)

    const userMsg = { role: 'user', content: text }
    const agentMsg = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, agentMsg])
    setStreaming(true)

    try {
      const token = localStorage.getItem('house_token') || ''
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const resp = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, history }),
      })

      if (!resp.ok) throw new Error(`AI 服务异常 (${resp.status})`)

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // 解析 SSE 事件
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.error) {
                setError(parsed.error)
              } else if (parsed.text) {
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last.role === 'assistant') {
                    last.content += parsed.text
                  }
                  return [...updated]
                })
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      setError(e.message)
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content) {
          last.content = '抱歉，连接失败了，请重试 😞'
        }
        return [...prev]
      })
    }
    setStreaming(false)
  }

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-2xl mx-auto">
      {/* 标题 */}
      <div className="flex items-center justify-between py-4 border-b border-zinc-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
              <h2 className="text-sm font-semibold text-zinc-800">Hermes · 装修管家</h2>
            <p className="text-[11px] text-zinc-400">AI 助你推进装修进度</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors" title="清空对话">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">👋</div>
            <p className="text-sm text-zinc-500 mb-2">你好！我是装修管家小美 🏠</p>
            <p className="text-xs text-zinc-400">可以问我预算、进度、下一步该做什么…</p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {['现在装修到哪一步了？', '预算还够吗？', '推荐一下智能家居', '什么时候该定橱柜？'].map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-indigo-500 text-white rounded-br-md'
                : 'bg-white border border-zinc-100 text-zinc-700 rounded-bl-md shadow-sm'
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

        {error && (
          <div className="text-center">
            <span className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-full">{error}</span>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* 输入框 */}
      <div className="flex-shrink-0 py-3 border-t border-zinc-100">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? "正在聆听…" : "输入问题，Enter 发送…"}
            disabled={streaming}
            className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-zinc-50 transition-all"
            autoFocus
          />
          {supported && (
            <button
              onClick={toggleMic}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                listening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
              title={listening ? "停止录音" : "语音输入"}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="w-11 h-11 rounded-xl bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-zinc-400 mt-1.5 text-center">
          Hermes · AI 建议仅供参考，重要决策请咨询专业人士
        </p>
      </div>
    </div>
  )
}
