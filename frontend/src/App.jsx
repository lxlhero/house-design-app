import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import Import from './pages/Import'
import Versions from './pages/Versions'
import FloorPlan from './pages/FloorPlan'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="items" element={<Items />} />
          <Route path="import" element={<Import />} />
          <Route path="versions" element={<Versions />} />
          <Route path="floorplan" element={<FloorPlan />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
