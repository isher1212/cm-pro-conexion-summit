import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import SyncBanner from './components/SyncBanner'
import Dashboard from './pages/Dashboard'
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
import Templates from './pages/Templates'
import Summit from './pages/Summit'
import Brand from './pages/Brand'
import Team from './pages/Team'
import Integrations from './pages/Integrations'
import ImageEditor from './pages/ImageEditor'
import Cleanup from './pages/Cleanup'

export default function App() {
  return (
    <BrowserRouter>
      <SyncBanner />
      <Layout>
        <Routes>
          <Route path="/summit" element={<Summit />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/library" element={<Library />} />
          <Route path="/competitors" element={<Competitors />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/brand" element={<Brand />} />
          <Route path="/team" element={<Team />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/editor" element={<ImageEditor />} />
          <Route path="/cleanup" element={<Cleanup />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
