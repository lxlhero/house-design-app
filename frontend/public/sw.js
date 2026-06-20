// 装修管家 — Service Worker v4
// 策略：/assets/* 缓存优先（hash不变），其他全部网络优先
// 修复：SPA路由不再被缓存，始终拉最新HTML

const ASSETS_CACHE = 'house-assets-v5';

// ═══ 哪些是静态资源（有hash，可缓存） ═══
function isStaticAsset(url) {
  const path = url.pathname
  return path.startsWith('/assets/')    // Vite 构建产物
      || path.endsWith('.png')          // 图标
      || path.endsWith('.svg')
      || path.endsWith('.glb')          // 3D模型
      || path.endsWith('.ico')
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== ASSETS_CACHE).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API — 永不缓存
  if (url.pathname.startsWith('/api/')) return

  // 静态资源 — 缓存优先
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          const clone = response.clone()
          caches.open(ASSETS_CACHE).then(cache => cache.put(event.request, clone))
          return response
        })
      })
    )
    return
  }

  // HTML / SPA路由 / manifest / sw.js / 其他 — 网络优先
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request)) // 离线回退
  )
})

// 收到更新通知 → 立即激活
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
})
