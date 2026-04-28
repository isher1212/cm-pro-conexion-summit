import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import Analytics from './pages/Analytics'
import Intelligence from './pages/Intelligence'
import Trends from './pages/Trends'
import Planner from './pages/Planner'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Saved from './pages/Saved'
import Library from './pages/Library'
import Competitors from './pages/Competitors'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/library" element={<Library />} />
          <Route path="/competitors" element={<Competitors />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
