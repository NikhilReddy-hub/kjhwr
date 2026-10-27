export default function Methodology() {
  return (
    <div>
      <h1 className="page-title">📐 Methodology & Assumptions</h1>
      <p className="page-description">
        How the Wind Procurement Portal selects forecasts, computes metrics, and what you should know before using the results.
      </p>

      <div className="methodology-panel mb-6">
        <h3>🎯 Problem Statement</h3>
        <p>
          UK electricity traders purchasing on the Day-Ahead market must commit their wind procurement volume
          before the auction gate closure (approximately 09:00–10:00 UK time on day D-1). They forecast
          residual demand as: <code>Residual demand = Total demand − Wind generation</code>.
          The wind generation must be estimated from a publicly-available forecast.
          This portal quantifies the uncertainty in that wind forecast, helping traders size a procurement buffer.
        </p>
        <p>
          <strong>Note:</strong> No demand data is available via Elexon BMRS in this scope.
          Only wind forecast uncertainty is quantified here. Residual demand buffer = wind forecast ± uncertainty.
        </p>
      </div>

      <div className="grid-2 mb-6">
        <div className="methodology-panel">
          <h3>📡 Data Sources</h3>
          <p><strong>Actuals — FUELHH dataset</strong></p>
          <ul>
            <li>Endpoint: <code>/datasets/FUELHH</code> with <code>settlementDateFrom/To</code></li>
            <li>Coverage: 1–31 January 2026 (1,488 half-hour periods)</li>
            <li>Fields: startTime, settlementDate, settlementPeriod, generation (MW)</li>
            <li>Resolution: 30-minute (48 periods per day)</li>
          </ul>
          <p style={{ marginTop: '12px' }}><strong>Forecasts — WINDFOR dataset</strong></p>
          <ul>
            <li>Endpoint: <code>/datasets/WINDFOR/stream</code> with <code>publishDateTimeFrom/To</code></li>
            <li>Coverage: 30 Dec 2025 – 31 Jan 2026 (19,272 rows)</li>
            <li>Fields: startTime, publishTime, generation (MW)</li>
            <li>Resolution: <strong>Hourly</strong> (not 30-min — see assumptions)</li>
            <li>Publish cadence: ~every 4 hours (07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC)</li>
          </ul>
        </div>

        <div className="methodology-panel">
          <h3>🧮 Key Assumptions</h3>
          <ul>
            <li>Decision cutoff = <code>09:00 UK local on D-1</code> (configurable)</li>
            <li>January 2026 is GMT (UTC+0), so cutoff = 09:00 UTC. No DST applies.</li>
            <li>WINDFOR is hourly: one forecast per hour, applied to both :00 and :30 periods</li>
            <li>"Latest forecast" = <code>max(publishTime) ≤ cutoff</code> per startTime</li>
            <li>No look-ahead leakage: strictly no forecasts published after cutoff are used</li>
            <li>Horizon = <code>startTime − publishTime</code> (hours)</li>
            <li>Data scope: national GB wind only, Elexon BMRS only</li>
          </ul>
        </div>
      </div>

      <div className="methodology-panel mb-6">
        <h3>📊 Metrics Definitions</h3>
        <ul>
          <li><strong>Error</strong> = Forecast − Actual (positive = overforecast, negative = underforecast)</li>
          <li><strong>MAE</strong> = Mean |Error| — average magnitude of error, easy to interpret in MW</li>
          <li><strong>RMSE</strong> = √(Mean Error²) — penalises large errors more than MAE</li>
          <li><strong>Bias</strong> = Mean Error — systematic direction; positive = consistently overforecasts</li>
          <li><strong>MAPE</strong> = Mean |Error/Actual| × 100% — omitted if any actual is zero</li>
          <li><strong>NMAE</strong> = MAE / Mean Actual × 100% — normalised to output level</li>
          <li><strong>P90/P95/P99</strong> = 90th/95th/99th percentile of |Error| — used for buffer sizing</li>
        </ul>
        <p style={{ marginTop: '12px' }}>
          <strong>Procurement buffer recommendation:</strong> Add P90 error to the wind forecast to ensure
          only 10% of half-hours will have under-procurement due to wind overestimation. Use P95 for higher confidence.
        </p>
      </div>

      <div className="methodology-panel mb-6">
        <h3>⚠️ Known Limitations & Data Quirks</h3>
        <ul>
          <li><strong>WINDFOR resolution:</strong> Hourly forecasts applied to 30-min periods — means error is identical for :00 and :30 within the same hour</li>
          <li><strong>FUELHH stream endpoint:</strong> The <code>/stream</code> variant ignores the date filter and returns today's data. We use the non-stream endpoint with date range params.</li>
          <li><strong>Forecast horizon:</strong> At 09:00 cutoff for January, the last-published forecast before cutoff was at ~07:30 UTC, giving horizons of ~16–40 hours ahead</li>
          <li><strong>No demand data:</strong> BMRS provides wind forecasts but demand forecasts require separate processing; out of scope</li>
          <li><strong>National-level only:</strong> No geographic breakdown; GB total wind only</li>
          <li><strong>January only:</strong> Only 31 days of data; seasonal patterns not captured</li>
          <li><strong>Missing periods:</strong> If WINDFOR has no publishTime ≤ cutoff for a period, that period is excluded from error analysis</li>
        </ul>
      </div>

      <div className="methodology-panel">
        <h3>🔭 Future Work</h3>
        <ul>
          <li>Extend to full year for seasonal analysis</li>
          <li>Add demand forecasts (MELIMF or TSDF from BMRS) to compute full residual demand uncertainty</li>
          <li>Regional wind breakdown (Scotland, England, Wales)</li>
          <li>Probabilistic procurement recommendation with cost model</li>
          <li>Real-time updates: auto-refresh from Elexon as new forecasts are published</li>
          <li>Alerting: notify traders when latest forecast deviates significantly from prior run</li>
        </ul>
      </div>
    </div>
  )
}
