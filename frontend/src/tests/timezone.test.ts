import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatTimeUTC,
  formatDateUTC,
  formatDateWithDayUTC,
  formatPublishTimeUTC,
  formatUKDate,
  formatDayMonthTimeUTC,
  formatDateShortUTC,
} from '../utils/dateUtils'

describe('Timezone-independent formatting', () => {
  const originalTZ = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTZ
  })

  const timezones = ['Asia/Kolkata', 'America/Los_Angeles', 'UTC', 'Europe/London']

  timezones.forEach(tz => {
    describe(`When browser timezone is ${tz}`, () => {
      beforeEach(() => {
        process.env.TZ = tz
      })

      it('correctly formats publish time in UTC as "14 Jan 07:30 UTC"', () => {
        // Must never shift to 13:00 (Asia/Kolkata) or 23:30 (America/Los_Angeles)
        const formatted = formatPublishTimeUTC('2026-01-14T07:30:00Z')
        expect(formatted).toBe('14 Jan 07:30 UTC')
      })

      it('correctly formats target time 12:00 UTC as "12:00"', () => {
        const formatted = formatTimeUTC('2026-01-15T12:00:00Z')
        expect(formatted).toBe('12:00')
      })

      it('correctly formats delivery start 00:00 UTC as "00:00"', () => {
        const formatted = formatTimeUTC('2026-01-15T00:00:00Z')
        expect(formatted).toBe('00:00')
      })

      it('correctly formats delivery end 23:30 UTC as "23:30"', () => {
        const formatted = formatTimeUTC('2026-01-15T23:30:00Z')
        expect(formatted).toBe('23:30')
      })

      it('correctly formats delivery date as "15 Jan 2026"', () => {
        const formatted = formatDateUTC('2026-01-15')
        expect(formatted).toBe('15 Jan 2026')
      })

      it('correctly formats date with weekday as "Thu 15 Jan 2026"', () => {
        const formatted = formatDateWithDayUTC('2026-01-15')
        expect(formatted).toBe('Thu 15 Jan 2026')
      })

      it('correctly formats UK cutoff date as "14 Jan 2026"', () => {
        const formatted = formatUKDate('2026-01-14T09:00:00Z')
        expect(formatted).toBe('14 Jan 2026')
      })

      it('correctly formats short date as "Thu 15 Jan"', () => {
        const formatted = formatDateShortUTC('2026-01-15')
        expect(formatted).toBe('Thu 15 Jan')
      })

      it('correctly formats day/month time as "15/01 12:00"', () => {
        const formatted = formatDayMonthTimeUTC('2026-01-15T12:00:00Z')
        expect(formatted).toBe('15/01 12:00')
      })
    })
  })
})
