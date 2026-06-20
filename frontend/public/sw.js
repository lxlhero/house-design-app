// 装修管家 — Service Worker
// 策略：HTML 网络优先（确保最新），静态资源缓存优先（有hash不变），API 不缓存

const CACHE_NAME = 'house-v3';
const STATIC_CACHE = 'house-static-v3';

// 哪些路径走网络优先（HTML 类）
const NETWORK_FIRST = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME && n !== STATIC_CACHE).map((n) => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 请求 — 永远不缓存
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML / 根路径 — 网络优先，离线时回退缓存
  if (NETWORK_FIRST.some(p => url.pathname === p)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 更新缓存为最新版本
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request)) // 离线回退
    );
    return;
  }

  // 静态资源（JS/CSS/图片） — 缓存优先（有 hash，文件名不变则内容不变）
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const cloned = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, cloned));
        return response;
      });
    })
  );
});

// 检测到新 SW 版本 → 通知页面刷新
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
