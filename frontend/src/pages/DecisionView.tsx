import { useState, useEffect } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  getLatestForecast,
  getAccuracySummary,
} from '../api/client'
import type {
  DecisionForecastResponse,
  AccuracySummary,
} from '../api/client'
import {
  formatTimeUTC,
  formatDateUTC,
  formatDateWithDayUTC,
  formatPublishTimeUTC,
  formatUKDate,
} from '../utils/dateUtils'

const JAN_DATES = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1
  return `2026-01-${String(d).padStart(2, '0')}`
})

const SETTLEMENT_PERIODS_48 = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const CUTOFF_OPTIONS = [
  { label: '07:00', hour: 7, minute: 0 },
  { label: '08:00', hour: 8, minute: 0 },
  { label: '09:00 (default)', hour: 9, minute: 0 },
  { label: '10:00', hour: 10, minute: 0 },
  { label: '11:00', hour: 11, minute: 0 },
]

interface ChartPoint {
  time: string
  forecast: number | null
  actual: number | null
  bandUpper: number | null
  bandLower: number | null
  horizon: number | null
}

export default function DecisionView() {
  const [deliveryDate, setDeliveryDate] = useState('2026-01-15')
  const [cutoffHour, setCutoffHour] = useState(9)
  const [cutoffMinute, setCutoffMinute] = useState(0)
  const [forecastData, setForecastData] = useState<DecisionForecastResponse | null>(null)
  const [summary, setSummary] = useState<AccuracySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [fcRes, sumRes] = await Promise.all([
        getLatestForecast(deliveryDate, cutoffHour, cutoffMinute),
        getAccuracySummary(cutoffHour, cutoffMinute),
      ])
      setForecastData(fcRes.data)
      setSummary(sumRes.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load data. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [deliveryDate, cutoffHour, cutoffMinute])

  // Build chart data — strictly 48 settlement periods (00:00 to 23:30 UTC)
  const chartData: ChartPoint[] = (() => {
    if (!forecastData) return []
    const fcMap = new Map(forecastData.forecast_points.map(f => [formatTimeUTC(f.start_time), f]))
    const actMap = new Map(forecastData.actuals.map(a => [formatTimeUTC(a.start_time), a]))
    const p90 = summary?.p90_abs_error_mw ?? 0

    return SETTLEMENT_PERIODS_48.map(time => {
      const fc = fcMap.get(time)
      const act = actMap.get(time)
      const fcVal = fc?.forecast_mw ?? null
      return {
        time,
        forecast: fcVal,
        actual: act?.actual_mw ?? null,
        bandUpper: fcVal !== null ? fcVal + p90 : null,
        bandLower: fcVal !== null ? Math.max(0, fcVal - p90) : null,
        horizon: fc?.horizon_hours ?? null,
      }
    })
  })()

  const publishTime = forecastData?.forecast_points?.[0]?.publish_time
    ? formatPublishTimeUTC(forecastData.forecast_points[0].publish_time)
    : '-'

  return (
    <div>
      <h1 className="page-title">⚡ Decision View</h1>
      <p className="page-description">
        Latest wind forecast available at decision time vs actual generation
      </p>

      {/* Controls */}
      <div className="controls-bar">
        <div className="control-group">
          <label className="control-label">Delivery Date</label>
          <select
            className="control-select"
            value={deliveryDate}
            onChange={e => setDeliveryDate(e.target.value)}
          >
            {JAN_DATES.map(d => (
              <option key={d} value={d}>
                {formatDateWithDayUTC(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label className="control-label">Decision Cutoff (D-1 UK local)</label>
          <select
            className="control-select"
            value={`${cutoffHour}:${cutoffMinute}`}
            onChange={e => {
              const [h, m] = e.target.value.split(':').map(Number)
              setCutoffHour(h)
              setCutoffMinute(m)
            }}
          >
            {CUTOFF_OPTIONS.map(o => (
              <option key={o.label} value={`${o.hour}:${o.minute}`}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {forecastData && (
          <div className="control-group">
            <label className="control-label">Latest Forecast Published</label>
            <div style={{ padding: '8px 12px', color: 'var(--color-accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
              {publishTime}
            </div>
          </div>
        )}
        <div className="control-group" style={{ flexDirection: 'row', gap: '8px', alignItems: 'flex-end' }}>
          <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
            {loading ? '⟳ Loading...' : '↻ Refresh'}
          </button>
          {forecastData && forecastData.forecast_points.length > 0 && (
            <button
              className="btn btn-secondary"
              title="Export 48 half-hour points to CSV"
              onClick={() => {
                const fcMap = new Map(forecastData.forecast_points.map(f => [formatTimeUTC(f.start_time), f]))
                const actMap = new Map(forecastData.actuals.map(a => [formatTimeUTC(a.start_time), a]))

                const rows = [
                  ['Delivery Date', 'Time (UTC)', 'Forecast (MW)', 'Actual (MW)', 'Error (MW)', 'Horizon (h)'],
                  ...SETTLEMENT_PERIODS_48.map(t => {
                    const fc = fcMap.get(t)
                    const act = actMap.get(t)
                    const fcVal = fc?.forecast_mw ?? ''
                    const actVal = act?.actual_mw ?? ''
                    const errVal = (fc?.forecast_mw != null && act?.actual_mw != null)
                      ? (fc.forecast_mw - act.actual_mw).toFixed(1)
                      : ''
                    const horiz = fc?.horizon_hours ?? ''
                    return [deliveryDate, `${t} UTC`, fcVal, actVal, errVal, horiz]
                  })
                ]

                const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n')
                const encodedUri = encodeURI(csvContent)
                const link = document.createElement('a')
                link.setAttribute('href', encodedUri)
                link.setAttribute('download', `windscope_${deliveryDate}_cutoff_${cutoffHour}h.csv`)
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
            >
              📥 Export CSV
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-state">⚠ {error}</div>}
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <span>Fetching forecast data...</span>
        </div>
      )}

      {!loading && forecastData && (
        <>
          {/* Info banner */}
          <div className="insight-box mb-6">
            <h4>📋 Forecast Selection</h4>
            <p>
              For delivery <strong>{formatDateUTC(deliveryDate)}</strong>, the cutoff is{' '}
              <strong>{String(cutoffHour).padStart(2,'0')}:{String(cutoffMinute).padStart(2,'0')} UK local on{' '}
              {formatUKDate(forecastData.cutoff_time_utc)}</strong>.{' '}
              The latest WINDFOR forecast published before this cutoff was at{' '}
              <strong>{publishTime}</strong>.{' '}
              {summary && (
                <>
                  Shaded band = ±P90 error ({summary.p90_abs_error_mw.toLocaleString()} MW) based on Jan 2026 history.
                </>
              )}
            </p>
          </div>

          {/* Main chart */}
          <div className="card mb-6">
            <div className="card-header">
              <div>
                <div className="card-title">
                  🌬️ Wind Generation: Forecast vs Actual
                </div>
                <div className="card-subtitle">
                  {formatDateUTC(deliveryDate)} · All 48 half-hour periods · MW
                </div>
              </div>
              {forecastData.missing_periods.length > 0 && (
                <span className="tag tag-orange">
                  {forecastData.missing_periods.length} periods missing
                </span>
              )}
            </div>
            <div className="chart-container" style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.08)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    interval={5}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={v => `${(v/1000).toFixed(0)}GW`}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    width={52}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const fc = payload.find(p => p.dataKey === 'forecast')?.value as number
                      const act = payload.find(p => p.dataKey === 'actual')?.value as number
                      return (
                        <div className="custom-tooltip">
                          <div className="tooltip-label">{label} UTC</div>
                          {fc != null && (
                            <div className="tooltip-row">
                              <span>Forecast</span>
                              <span className="tooltip-value" style={{ color: 'var(--chart-forecast)' }}>
                                {fc?.toLocaleString()} MW
                              </span>
                            </div>
                          )}
                          {act != null && (
                            <div className="tooltip-row">
                              <span>Actual</span>
                              <span className="tooltip-value" style={{ color: 'var(--chart-actual)' }}>
                                {act?.toLocaleString()} MW
                              </span>
                            </div>
                          )}
                          {fc != null && act != null && (
                            <div className="tooltip-row">
                              <span>Error</span>
                              <span className="tooltip-value" style={{ color: fc - act > 0 ? '#f59e0b' : '#34d399' }}>
                                {(fc - act > 0 ? '+' : '')}{(fc - act)?.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW
                              </span>
                            </div>
                          )}
                          {payload[0]?.payload?.horizon != null && (
                            <div className="tooltip-row">
                              <span>Horizon</span>
                              <span className="tooltip-value" style={{ color: 'var(--text-muted)' }}>
                                {payload[0].payload.horizon}h
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="bandUpper"
                    fill="rgba(59,130,246,0.12)"
                    stroke="none"
                    name="P90 Upper"
                  />
                  <Area
                    type="monotone"
                    dataKey="bandLower"
                    fill="var(--color-bg)"
                    stroke="none"
                    name="P90 Lower"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="var(--chart-forecast)"
                    strokeWidth={2}
                    dot={false}
                    name="Forecast"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="var(--chart-actual)"
                    strokeWidth={2}
                    dot={false}
                    name="Actual"
                    strokeDasharray="5 3"
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="legend mt-4">
              <div className="legend-item">
                <div className="legend-dot" style={{ background: 'var(--chart-forecast)' }} />
                Forecast
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: 'var(--chart-actual)', opacity: 0.7 }} />
                Actual (dashed)
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: 'rgba(59,130,246,0.25)' }} />
                P90 Error Band (±{summary?.p90_abs_error_mw?.toLocaleString()} MW)
              </div>
            </div>
          </div>

          {/* Stats */}
          {summary && (
            <div className="insight-box">
              <h4>💡 Practical Takeaway</h4>
              <p>
                Based on January 2026 history at {String(cutoffHour).padStart(2,'0')}:00 UK cutoff:{' '}
                <strong>MAE = {summary.mae_mw.toLocaleString()} MW</strong>,{' '}
                <strong>P90 error = {summary.p90_abs_error_mw.toLocaleString()} MW</strong>.{' '}
                Residual demand to procure = [Total demand] − [Forecast wind].{' '}
                Add a buffer of <strong>+{summary.p90_abs_error_mw.toLocaleString()} MW</strong> to cover 90% of forecast uncertainty.{' '}
                Note: demand data is not available from Elexon BMRS in this scope; only wind forecast uncertainty is quantified here.
              </p>
            </div>
          )}
        </>
      )}

      {!loading && !error && forecastData?.forecast_points.length === 0 && (
        <div className="empty-state">
          <p>No forecast data available for this date/cutoff combination.</p>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>Ensure the data ingestion script has been run.</p>
        </div>
      )}

      {/* Methodology */}
      <div className="methodology-panel mt-4">
        <h3>📐 Methodology</h3>
        <p>
          <strong>Forecast selection (no look-ahead):</strong> For delivery day D, the decision cutoff is{' '}
          <code>{String(cutoffHour).padStart(2,'0')}:00 UK local time on D-1</code> (configurable above).
          In January (GMT = UTC+0), this equals the same hour UTC. The "latest available forecast" is the
          WINDFOR row with <code>max(publishTime) ≤ cutoff</code> for each target startTime.
        </p>
        <p>
          <strong>Resolution:</strong> WINDFOR data is published hourly. Each hour-ahead forecast is
          applied to both the :00 and :30 settlement periods within that hour.
        </p>
        <ul>
          <li>Forecast horizon = startTime − publishTime (hours)</li>
          <li>For Jan 2026 at 09:00 cutoff, horizon ≈ 15–39 hours ahead</li>
          <li>Uncertainty band = ±P90 absolute error from Jan 2026 history</li>
          <li>No demand data available; only wind forecast uncertainty is quantified</li>
        </ul>
      </div>
    </div>
  )
}
