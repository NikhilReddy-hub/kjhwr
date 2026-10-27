import { useState, useEffect } from 'react'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, BarChart,
} from 'recharts'
import {
  getAccuracySummary, getAccuracyByHour, getAccuracyByHorizon,
  getAccuracyTimeseries, getErrorDistribution, getAccuracyByDay,
} from '../api/client'
import type {
  AccuracySummary, HourlyBreakdown, HorizonBreakdown,
  TimeseriesPoint, ErrorDistribution, DailyBreakdown,
} from '../api/client'
import { formatDayMonthTimeUTC, formatDateShortUTC } from '../utils/dateUtils'

const CUTOFF_OPTIONS = [
  { label: '07:00', hour: 7, minute: 0 },
  { label: '08:00', hour: 8, minute: 0 },
  { label: '09:00 (default)', hour: 9, minute: 0 },
  { label: '10:00', hour: 10, minute: 0 },
  { label: '11:00', hour: 11, minute: 0 },
]

function KpiCard({ label, value, unit, desc, color }: {
  label: string; value: string | number; unit?: string; desc?: string; color: string
}) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {desc && <div className="kpi-desc">{desc}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((p: any) => (
        <div className="tooltip-row" key={p.dataKey}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="tooltip-value">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value} MW</span>
        </div>
      ))}
    </div>
  )
}

export default function AccuracyDashboard() {
  const [cutoffHour, setCutoffHour] = useState(9)
  const [cutoffMinute, setCutoffMinute] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<AccuracySummary | null>(null)
  const [byHour, setByHour] = useState<HourlyBreakdown[]>([])
  const [byHorizon, setByHorizon] = useState<HorizonBreakdown[]>([])
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([])
  const [distribution, setDistribution] = useState<ErrorDistribution | null>(null)
  const [byDay, setByDay] = useState<DailyBreakdown[]>([])

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumR, hourR, horizR, tsR, distR, dayR] = await Promise.all([
        getAccuracySummary(cutoffHour, cutoffMinute),
        getAccuracyByHour(cutoffHour, cutoffMinute),
        getAccuracyByHorizon(cutoffHour, cutoffMinute),
        getAccuracyTimeseries(cutoffHour, cutoffMinute),
        getErrorDistribution(cutoffHour, cutoffMinute),
        getAccuracyByDay(cutoffHour, cutoffMinute),
      ])
      setSummary(sumR.data)
      setByHour(hourR.data.breakdown)
      setByHorizon(horizR.data.breakdown)
      setTimeseries(tsR.data.points)
      setDistribution(distR.data)
      setByDay(dayR.data.breakdown)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load accuracy data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [cutoffHour, cutoffMinute])

  // Prepare timeseries chart data (sample every 2nd point for perf)
  const tsChartData = timeseries
    .filter((_, i) => i % 2 === 0)
    .map(p => ({
      time: p.start_time ? formatDayMonthTimeUTC(p.start_time) : '',
      forecast: p.forecast_mw,
      actual: p.actual_mw,
      error: p.error_mw,
    }))

  // Histogram data
  const histData = distribution
    ? distribution.bin_edges_mw.slice(0, -1).map((edge, i) => ({
        bin: `${edge.toFixed(0)}`,
        count: distribution.counts[i],
      }))
    : []

  // Bias direction color
  const biasColor = summary && summary.bias_mw > 0 ? '#f59e0b' : '#10b981'

  return (
    <div>
      <h1 className="page-title">📊 Accuracy Dashboard</h1>
      <p className="page-description">
        Forecast error analysis for January 2026 — wind generation (MW)
      </p>

      {/* Cutoff selector */}
      <div className="controls-bar mb-6">
        <div className="control-group">
          <label className="control-label">Decision Cutoff (UK local, D-1)</label>
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
        <div className="control-group">
          <label className="control-label">&nbsp;</label>
          <button className="btn btn-primary" onClick={fetchAll} disabled={loading}>
            {loading ? '⟳ Calculating...' : '↻ Update'}
          </button>
        </div>
        {summary && (
          <div className="control-group" style={{ marginLeft: 'auto' }}>
            <label className="control-label">Periods analysed</label>
            <div style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-accent)', fontSize: '14px' }}>
              {summary.n_periods.toLocaleString()} half-hours
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-state">⚠ {error}</div>}
      {loading && <div className="loading-state"><div className="spinner" /><span>Computing accuracy metrics...</span></div>}

      {!loading && summary && (
        <>
          {/* KPI Grid */}
          <div className="kpi-grid">
            <KpiCard label="MAE" value={summary.mae_mw} unit=" MW"
              desc="Mean Absolute Error" color="blue" />
            <KpiCard label="RMSE" value={summary.rmse_mw} unit=" MW"
              desc="Root Mean Squared Error" color="blue" />
            <KpiCard label="Bias" value={summary.bias_mw} unit=" MW"
              desc={summary.bias_mw > 0 ? 'Overforecast (forecast > actual)' : 'Underforecast (forecast < actual)'}
              color="orange" />
            <KpiCard label="P90 Error" value={summary.p90_abs_error_mw} unit=" MW"
              desc="90th percentile abs error = procurement buffer" color="orange" />
            <KpiCard label="P95 Error" value={summary.p95_abs_error_mw} unit=" MW"
              desc="For high-confidence buffer sizing" color="purple" />
            <KpiCard label="NMAE" value={`${summary.nmae_pct.toFixed(1)}%`}
              desc="MAE as % of mean actual wind" color="green" />
            <KpiCard label="Mean Actual" value={summary.mean_actual_mw} unit=" MW"
              desc="Average wind in January 2026" color="green" />
            <KpiCard label="Mean Forecast" value={summary.mean_forecast_mw} unit=" MW"
              desc="Average forecast at this cutoff" color="blue" />
          </div>

          {/* Insight callout */}
          <div className="insight-box mb-6">
            <h4>💡 Key Insight — January 2026</h4>
            <p>
              At the <strong>{String(cutoffHour).padStart(2,'0')}:00 UK decision cutoff</strong>:{' '}
              MAE = <strong>{summary.mae_mw.toLocaleString()} MW</strong>, RMSE = <strong>{summary.rmse_mw.toLocaleString()} MW</strong>,
              Bias = <strong style={{ color: biasColor }}>{summary.bias_mw > 0 ? '+' : ''}{summary.bias_mw.toLocaleString()} MW</strong>{' '}
              ({summary.bias_mw > 0 ? 'overforecast' : 'underforecast'}).{' '}
              A procurement buffer of <strong>{summary.p90_abs_error_mw.toLocaleString()} MW (P90)</strong> or{' '}
              <strong>{summary.p95_abs_error_mw.toLocaleString()} MW (P95)</strong> is recommended.{' '}
              This represents <strong>{summary.nmae_pct.toFixed(1)}%</strong> of mean wind output.
            </p>
          </div>

          {/* Timeseries chart */}
          <div className="card mb-6">
            <div className="card-header">
              <div>
                <div className="card-title">📈 Forecast vs Actual — January 2026</div>
                <div className="card-subtitle">All delivery days · sampled every 2 periods for clarity</div>
              </div>
            </div>
            <div className="chart-container" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tsChartData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.08)" />
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={47}
                    tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={v => `${(v/1000).toFixed(0)}GW`}
                    tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} width={52} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="forecast" stroke="var(--chart-forecast)"
                    strokeWidth={1.5} dot={false} name="Forecast" connectNulls />
                  <Line type="monotone" dataKey="actual" stroke="var(--chart-actual)"
                    strokeWidth={1.5} dot={false} name="Actual" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="legend mt-4">
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-forecast)' }} />Forecast</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-actual)' }} />Actual</div>
            </div>
          </div>

          {/* Error distribution + By Hour */}
          <div className="grid-2 mb-6">
            {/* Error distribution */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">📉 Error Distribution</div>
              </div>
              {distribution && (
                <>
                  <div className="chart-container" style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.08)" />
                        <XAxis dataKey="bin" tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                          interval={7} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false}
                          axisLine={{ stroke: 'var(--color-border)' }} width={36} />
                        <Tooltip formatter={(v: any) => [v, 'periods']} />
                        <Bar dataKey="count" name="Periods" radius={[3,3,0,0]}>
                          {histData.map((entry, i) => {
                            const mid = parseFloat(entry.bin)
                            const color = mid < -distribution.p90 || mid > distribution.p90
                              ? 'rgba(239,68,68,0.6)'
                              : mid < -distribution.p50 || mid > distribution.p50
                                ? 'rgba(245,158,11,0.7)'
                                : 'rgba(59,130,246,0.8)'
                            return <Cell key={i} fill={color} />
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    <span>P50: <strong style={{ color: 'var(--text-primary)' }}>{distribution.p50} MW</strong></span>
                    <span>P90: <strong style={{ color: '#f59e0b' }}>{distribution.p90} MW</strong></span>
                    <span>P95: <strong style={{ color: '#ef4444' }}>{distribution.p95} MW</strong></span>
                  </div>
                </>
              )}
            </div>

            {/* By Hour */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">🕐 MAE by Hour of Day (UTC)</div>
              </div>
              <div className="chart-container" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byHour} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.08)" />
                    <XAxis dataKey="hour_utc" tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      tickLine={false} axisLine={{ stroke: 'var(--color-border)' }}
                      tickFormatter={v => `${String(v).padStart(2,'0')}h`} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false}
                      axisLine={{ stroke: 'var(--color-border)' }} width={50} />
                    <Tooltip formatter={(v: any) => [`${v} MW`, 'MAE']} />
                    <Bar dataKey="mae_mw" name="MAE" fill="var(--color-primary)" radius={[3,3,0,0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* By Horizon */}
          <div className="card mb-6">
            <div className="card-header">
              <div className="card-title">⏱️ Accuracy by Forecast Horizon</div>
              <div className="card-subtitle">How error changes with lead time</div>
            </div>
            <div className="chart-container" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={byHorizon} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.08)" />
                  <XAxis dataKey="horizon_bucket" tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="mae_mw" name="MAE" fill="rgba(59,130,246,0.7)" radius={[4,4,0,0]} />
                  <Line type="monotone" dataKey="rmse_mw" name="RMSE" stroke="var(--color-warning)"
                    strokeWidth={2} dot={{ fill: 'var(--color-warning)', r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="legend mt-4">
              <div className="legend-item"><div className="legend-dot" style={{ background: 'rgba(59,130,246,0.7)' }} />MAE</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--color-warning)' }} />RMSE</div>
            </div>
          </div>

          {/* By Day table */}
          <div className="card mb-6">
            <div className="card-header">
              <div className="card-title">📅 Daily Accuracy Breakdown</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Periods</th>
                    <th>Mean Actual (MW)</th>
                    <th>MAE (MW)</th>
                    <th>Bias (MW)</th>
                    <th>P90 Error (MW)</th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.map(d => (
                    <tr key={d.date}>
                      <td>{formatDateShortUTC(d.date)}</td>
                      <td className="num">{d.n_periods}</td>
                      <td className="num">{d.mean_actual_mw.toLocaleString()}</td>
                      <td className="num">{d.mae_mw.toLocaleString()}</td>
                      <td className="num" style={{ color: d.bias_mw > 0 ? '#f59e0b' : '#34d399' }}>
                        {d.bias_mw > 0 ? '+' : ''}{d.bias_mw.toLocaleString()}
                      </td>
                      <td className="num">{d.p90_abs_error_mw.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
