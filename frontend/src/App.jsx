import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './components/Login'

import Dashboard from './pages/Dashboard'

const Items = lazy(() => import('./pages/Items'))
const Import = lazy(() => import('./pages/Import'))
const Versions = lazy(() => import('./pages/Versions'))
const FloorPlan = lazy(() => import('./pages/FloorPlan'))
const AgentChat = lazy(() => import('./pages/AgentChat'))

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-zinc-400 text-sm">加载中…</div>
    </div>
  )
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('house_token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="items" element={<Suspense fallback={<PageLoading />}><Items /></Suspense>} />
          <Route path="import" element={<Suspense fallback={<PageLoading />}><Import /></Suspense>} />
          <Route path="floorplan" element={<Suspense fallback={<PageLoading />}><FloorPlan /></Suspense>} />
          <Route path="agent" element={<Suspense fallback={<PageLoading />}><AgentChat /></Suspense>} />
          {/* 版本管理保留路由但不显示在导航 */}
          <Route path="versions" element={<Suspense fallback={<PageLoading />}><Versions /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
