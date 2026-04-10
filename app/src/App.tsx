import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthedShell } from './layout/AuthedShell'
import { AccountPage } from './pages/AccountPage'
import { ContributePage } from './pages/ContributePage'
import { LandingPage } from './pages/LandingPage'
import { StudioDemoPage } from './pages/StudioDemoPage'
import { WatchPage } from './pages/WatchPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AuthedShell />}>
          <Route path="/watch" element={<WatchPage />} />
          <Route path="/studio" element={<StudioDemoPage />} />
          <Route path="/contribute" element={<ContributePage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
