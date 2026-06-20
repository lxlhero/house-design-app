import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ═══ Service Worker v4 — 自动更新 + 清理旧缓存 ═══
if ('serviceWorker' in navigator) {
  async function registerSW() {
    try {
      // 先注销所有旧 SW（清理 v1/v2/v3 残留）
      const oldRegs = await navigator.serviceWorker.getRegistrations()
      for (const reg of oldRegs) {
        if (reg.active && !reg.active.scriptURL.includes('sw.js')) continue
      }
      
      const registration = await navigator.serviceWorker.register('/sw.js')
      
      // 发现新版本 → 立即激活 → 刷新页面
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] 新版本已安装，刷新页面…')
            window.location.reload()
          }
        })
      })
      
      // 定期检查更新
      setInterval(() => {
        registration.update().catch(() => {})
      }, 10 * 60 * 1000) // 每10分钟
      
    } catch (e) {
      console.warn('[SW] 注册失败:', e.message)
    }
  }
  
  registerSW()
}
