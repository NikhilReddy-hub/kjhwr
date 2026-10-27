import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
  formatTimeUTC,
  formatDateUTC,
  formatPublishTimeUTC,
  formatUKDate,
} from '../utils/dateUtils'

// Mock forecast response for 15 Jan 2026
const mockForecast = {
  delivery_date: '2026-01-15',
  cutoff_time_utc: '2026-01-14T09:00:00+00:00',
  cutoff_time_local: '09:00 UK local (D-1)',
  forecast_points: [
    {
      start_time: '2026-01-15T00:00:00+00:00',
      publish_time: '2026-01-14T07:30:00+00:00',
      forecast_mw: 14227.0,
      horizon_hours: 16.5,
    },
    {
      start_time: '2026-01-15T12:00:00+00:00',
      publish_time: '2026-01-14T07:30:00+00:00',
      forecast_mw: 11049.0,
      horizon_hours: 28.5,
    },
    {
      start_time: '2026-01-15T23:30:00+00:00',
      publish_time: '2026-01-14T07:30:00+00:00',
      forecast_mw: 11843.0,
      horizon_hours: 40.0,
    },
  ],
  actuals: [
    { start_time: '2026-01-15T00:00:00+00:00', actual_mw: 13500.0 },
    { start_time: '2026-01-15T12:00:00+00:00', actual_mw: 9742.0 },
    { start_time: '2026-01-15T23:30:00+00:00', actual_mw: 11200.0 },
  ],
}

// Banner Component under test
function DecisionBanner({ data }: { data: typeof mockForecast }) {
  const publishTime = formatPublishTimeUTC(data.forecast_points[0].publish_time)
  const deliveryFormatted = formatDateUTC(data.delivery_date)
  const cutoffDate = formatUKDate(data.cutoff_time_utc)

  return (
    <div data-testid="decision-banner">
      <div data-testid="latest-published">{publishTime}</div>
      <div data-testid="info-text">
        For delivery {deliveryFormatted}, the cutoff is 09:00 UK local on {cutoffDate}.
        The latest WINDFOR forecast published before this cutoff was at {publishTime}.
      </div>
    </div>
  )
}

// Tooltip Component under test
function DecisionTooltip({ timeSlot, data }: { timeSlot: string; data: typeof mockForecast }) {
  const fc = data.forecast_points.find(p => formatTimeUTC(p.start_time) === timeSlot)
  const act = data.actuals.find(a => formatTimeUTC(a.start_time) === timeSlot)
  const fcVal = fc?.forecast_mw ?? null
  const actVal = act?.actual_mw ?? null
  const errVal = (fcVal != null && actVal != null) ? fcVal - actVal : null

  return (
    <div data-testid="custom-tooltip">
      <div data-testid="tooltip-label">{timeSlot} UTC</div>
      {fcVal != null && <div data-testid="tooltip-forecast">{fcVal.toLocaleString()} MW</div>}
      {actVal != null && <div data-testid="tooltip-actual">{actVal.toLocaleString()} MW</div>}
      {errVal != null && (
        <div data-testid="tooltip-error">
          {(errVal > 0 ? '+' : '')}{errVal.toLocaleString()} MW
        </div>
      )}
      {fc?.horizon_hours != null && (
        <div data-testid="tooltip-horizon">{fc.horizon_hours}h</div>
      )}
    </div>
  )
}

describe('Component rendering under different browser timezones', () => {
  const originalTZ = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTZ
  })

  for (const tz of ['Asia/Kolkata', 'America/Los_Angeles']) {
    describe(`Rendering in timezone ${tz}`, () => {
      beforeEach(() => {
        process.env.TZ = tz
      })

      it('renders banner with correct "14 Jan 07:30 UTC" publish time', () => {
        render(<DecisionBanner data={mockForecast} />)
        expect(screen.getByTestId('latest-published').textContent).toBe('14 Jan 07:30 UTC')
        expect(screen.getByTestId('info-text').textContent).toContain('14 Jan 07:30 UTC')
        expect(screen.getByTestId('info-text').textContent).toContain('15 Jan 2026')
      })

      it('renders 12:00 UTC tooltip with expected 11,049 / 9,742 / +1,307 values', () => {
        render(<DecisionTooltip timeSlot="12:00" data={mockForecast} />)
        expect(screen.getByTestId('tooltip-label').textContent).toBe('12:00 UTC')
        expect(screen.getByTestId('tooltip-forecast').textContent).toBe('11,049 MW')
        expect(screen.getByTestId('tooltip-actual').textContent).toBe('9,742 MW')
        expect(screen.getByTestId('tooltip-error').textContent).toBe('+1,307 MW')
        expect(screen.getByTestId('tooltip-horizon').textContent).toBe('28.5h')
      })
    })
  }
})
