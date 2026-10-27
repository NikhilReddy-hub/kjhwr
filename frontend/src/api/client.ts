import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export interface ForecastPoint {
  start_time: string
  publish_time: string
  forecast_mw: number
  horizon_hours: number
}

export interface ActualPoint {
  start_time: string
  actual_mw: number
}

export interface DecisionForecastResponse {
  delivery_date: string
  cutoff_time_utc: string
  cutoff_time_local: string
  forecast_points: ForecastPoint[]
  actuals: ActualPoint[]
  missing_periods: string[]
}

export interface AccuracySummary {
  n_periods: number
  mae_mw: number
  rmse_mw: number
  bias_mw: number
  mape_pct: number | null
  nmae_pct: number
  p50_abs_error_mw: number
  p90_abs_error_mw: number
  p95_abs_error_mw: number
  p99_abs_error_mw: number
  mean_actual_mw: number
  mean_forecast_mw: number
}

export interface HourlyBreakdown {
  hour_utc: number
  n: number
  mae_mw: number
  bias_mw: number
  p90_abs_error_mw: number
}

export interface HorizonBreakdown {
  horizon_bucket: string
  horizon_min_h: number
  horizon_max_h: number
  n: number
  mae_mw: number
  rmse_mw: number
  bias_mw: number
}

export interface DailyBreakdown {
  date: string
  n_periods: number
  mae_mw: number
  bias_mw: number
  p90_abs_error_mw: number
  mean_actual_mw: number
}

export interface TimeseriesPoint {
  start_time: string
  forecast_mw: number | null
  actual_mw: number | null
  error_mw: number | null
  horizon_hours: number | null
}

export interface ErrorDistribution {
  bin_edges_mw: number[]
  counts: number[]
  p50: number
  p90: number
  p95: number
}

export interface HealthResponse {
  status: string
  version: string
  data_loaded: boolean
  actuals_count: number
  forecasts_count: number
}

export interface LiveStatus {
  source: string
  is_realtime: boolean
  latest_actual_mw: number | null
  latest_actual_time: string | null
  latest_settlement_period: number | null
  active_forecast_points: number
  latest_forecast_mw: number | null
  latest_forecast_start_time: string | null
}

// API calls
export const getHealth = () => api.get<HealthResponse>('/health')
export const getLiveStatus = () => api.get<LiveStatus>('/live/status')

export const getLatestForecast = (
  deliveryDate: string,
  cutoffHour: number = 9,
  cutoffMinute: number = 0
) =>
  api.get<DecisionForecastResponse>('/forecast/latest', {
    params: { delivery_date: deliveryDate, cutoff_hour: cutoffHour, cutoff_minute: cutoffMinute },
  })

export const getAccuracySummary = (cutoffHour: number = 9, cutoffMinute: number = 0) =>
  api.get<AccuracySummary>('/accuracy/summary', {
    params: { cutoff_hour: cutoffHour, cutoff_minute: cutoffMinute },
  })

export const getAccuracyByHour = (cutoffHour: number = 9, cutoffMinute: number = 0) =>
  api.get<{ breakdown: HourlyBreakdown[] }>('/accuracy/by-hour', {
    params: { cutoff_hour: cutoffHour, cutoff_minute: cutoffMinute },
  })

export const getAccuracyByHorizon = (cutoffHour: number = 9, cutoffMinute: number = 0) =>
  api.get<{ breakdown: HorizonBreakdown[] }>('/accuracy/by-horizon', {
    params: { cutoff_hour: cutoffHour, cutoff_minute: cutoffMinute },
  })

export const getAccuracyTimeseries = (cutoffHour: number = 9, cutoffMinute: number = 0) =>
  api.get<{ points: TimeseriesPoint[] }>('/accuracy/timeseries', {
    params: { cutoff_hour: cutoffHour, cutoff_minute: cutoffMinute },
  })

export const getAccuracyByDay = (cutoffHour: number = 9, cutoffMinute: number = 0) =>
  api.get<{ breakdown: DailyBreakdown[] }>('/accuracy/by-day', {
    params: { cutoff_hour: cutoffHour, cutoff_minute: cutoffMinute },
  })

export const getErrorDistribution = (cutoffHour: number = 9, cutoffMinute: number = 0) =>
  api.get<ErrorDistribution>('/accuracy/error-distribution', {
    params: { cutoff_hour: cutoffHour, cutoff_minute: cutoffMinute },
  })

