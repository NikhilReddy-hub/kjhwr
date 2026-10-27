import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import DecisionView from './pages/DecisionView'
import AccuracyDashboard from './pages/AccuracyDashboard'
import Methodology from './pages/Methodology'
import { getHealth, getLiveStatus } from './api/client'
import type { HealthResponse, LiveStatus } from './api/client'
import './index.css'

function AppShell() {
  const location = useLocation()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [live, setLive] = useState<LiveStatus | null>(null)

  useEffect(() => {
    getHealth().then(r => setHealth(r.data)).catch(() => {})
    getLiveStatus().then(r => setLive(r.data)).catch(() => {})
  }, [])

  const pageTitle = location.pathname === '/'
    ? 'Decision View'
    : location.pathname === '/accuracy'
    ? 'Accuracy Dashboard'
    : 'Methodology'

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <div className="brand-icon">💨</div>
            <div>
              <div className="brand-name">WindScope</div>
            </div>
          </div>
          <div className="brand-sub">UK Wind Procurement Portal</div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-section-label">Analytics</div>

          <NavLink
            to="/"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            end
          >
            <span className="nav-item-icon">⚡</span>
            Decision View
          </NavLink>

          <NavLink
            to="/accuracy"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-item-icon">📊</span>
            Accuracy Dashboard
          </NavLink>

          <div className="nav-section-label" style={{ marginTop: '12px' }}>Reference</div>

          <NavLink
            to="/methodology"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-item-icon">📐</span>
            Methodology
          </NavLink>
        </div>

        {/* Data status at bottom */}
        {health && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: '6px', fontWeight: 600, color: health.data_loaded ? 'var(--color-accent)' : 'var(--color-warning)' }}>
              {health.data_loaded ? '✓ Data loaded' : '⚠ No data'}
            </div>
            <div>Actuals: {health.actuals_count.toLocaleString()}</div>
            <div>Forecasts: {health.forecasts_count.toLocaleString()}</div>
            <div style={{ marginTop: '4px' }}>v{health.version}</div>
          </div>
        )}
      </nav>

      {/* Main */}
      <div className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="header-title">{pageTitle}</span>
            <span className="header-breadcrumb">WindScope · January 2026 · Elexon BMRS</span>
          </div>
          <div className="header-spacer" />
          {live?.latest_actual_mw && (
            <div className="status-badge" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)' }}>
              <div className="status-dot" style={{ background: '#10b981' }} />
              Live UK Grid: {live.latest_actual_mw.toLocaleString()} MW (Period {live.latest_settlement_period})
            </div>
          )}
          <div className="status-badge">
            <div className="status-dot" />
            {health?.data_loaded ? 'Elexon Data Active' : 'No Data'}
          </div>
          <div className="status-badge">
            📅 Jan 2026 Scope
          </div>
        </header>

        <main className="page-container">
          <Routes>
            <Route path="/" element={<DecisionView />} />
            <Route path="/accuracy" element={<AccuracyDashboard />} />
            <Route path="/methodology" element={<Methodology />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
