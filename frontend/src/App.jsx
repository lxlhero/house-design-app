import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './components/Login'

// 首屏立即加载（轻量）
import Dashboard from './pages/Dashboard'

// 懒加载 — 按需加载，减小首屏 JS 体积
const Items = lazy(() => import('./pages/Items'))
const Import = lazy(() => import('./pages/Import'))
const Versions = lazy(() => import('./pages/Versions'))
const FloorPlan = lazy(() => import('./pages/FloorPlan'))

// 加载中占位
function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-zinc-400 text-sm">加载中…</div>
    </div>
  )
}

// 简单的路由守卫：没有 token 跳转登录
function RequireAuth({ children }) {
  const token = localStorage.getItem('house_token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="items" element={
            <Suspense fallback={<PageLoading />}><Items /></Suspense>
          } />
          <Route path="import" element={
            <Suspense fallback={<PageLoading />}><Import /></Suspense>
          } />
          <Route path="versions" element={
            <Suspense fallback={<PageLoading />}><Versions /></Suspense>
          } />
          <Route path="floorplan" element={
            <Suspense fallback={<PageLoading />}><FloorPlan /></Suspense>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
