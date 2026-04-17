import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthedShell } from './layout/AuthedShell'
import { AccountPage } from './pages/AccountPage'
import { ContributePage } from './pages/ContributePage'
import { LandingPage } from './pages/LandingPage'
import { StudioDemoPage } from './pages/StudioDemoPage'
import './App.css'

/** Code-split Kamino / Orca (heavy); load only on /watch after Buffer polyfill has run. */
const WatchPage = lazy(async () => {
  const m = await import('./pages/WatchPage')
  return { default: m.WatchPage }
})

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AuthedShell />}>
          <Route
            path="/watch"
            element={
              <Suspense fallback={<div className="app-route-loading">Loading Watch…</div>}>
                <WatchPage />
              </Suspense>
            }
          />
          <Route path="/dashboard" element={<StudioDemoPage />} />
          <Route path="/studio" element={<Navigate to="/dashboard" replace />} />
          <Route path="/contribute" element={<ContributePage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
