/**
 * Robust UTC and UK-local date/time formatting utilities.
 * Ensures consistent output regardless of client/browser timezone.
 */

function toDate(ts: string | Date): Date {
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') {
    // If it's pure date YYYY-MM-DD, parse as UTC midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) {
      return new Date(`${ts}T00:00:00Z`)
    }
    // If ends with offset or Z, standard Date parsing handles it
    if (!ts.endsWith('Z') && !ts.includes('+') && !ts.includes('-')) {
      return new Date(`${ts}Z`)
    }
  }
  return new Date(ts)
}

/** Formats as 'HH:mm' in UTC (e.g. '07:30', '12:00') */
export function formatTimeUTC(ts: string | Date): string {
  const d = toDate(ts)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** Formats as 'd MMM yyyy' in UTC (e.g. '15 Jan 2026') */
export function formatDateUTC(ts: string | Date): string {
  const d = toDate(ts)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d)
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const year = parts.find(p => p.type === 'year')?.value ?? ''
  return `${day} ${month} ${year}`
}

/** Formats as 'EEE d MMM yyyy' in UTC (e.g. 'Thu 15 Jan 2026') */
export function formatDateWithDayUTC(ts: string | Date): string {
  const d = toDate(ts)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const year = parts.find(p => p.type === 'year')?.value ?? ''
  return `${weekday} ${day} ${month} ${year}`
}

/** Formats as 'EEE d MMM' in UTC (e.g. 'Thu 15 Jan') */
export function formatDateShortUTC(ts: string | Date): string {
  const d = toDate(ts)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(d)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  return `${weekday} ${day} ${month}`
}

/** Formats publish time as 'd MMM HH:mm UTC' (e.g. '14 Jan 07:30 UTC') */
export function formatPublishTimeUTC(ts: string | Date): string {
  const d = toDate(ts)
  if (isNaN(d.getTime())) return '-'
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const hour = parts.find(p => p.type === 'hour')?.value ?? ''
  const minute = parts.find(p => p.type === 'minute')?.value ?? ''
  return `${day} ${month} ${hour}:${minute} UTC`
}

/** Formats as 'dd/MM HH:mm' in UTC (e.g. '15/01 12:00') */
export function formatDayMonthTimeUTC(ts: string | Date): string {
  const d = toDate(ts)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const hour = parts.find(p => p.type === 'hour')?.value ?? ''
  const minute = parts.find(p => p.type === 'minute')?.value ?? ''
  return `${day}/${month} ${hour}:${minute}`
}

/** Formats as UK local time 'd MMM yyyy' or 'HH:mm' in Europe/London */
export function formatUKDate(ts: string | Date): string {
  const d = toDate(ts)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d)
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const year = parts.find(p => p.type === 'year')?.value ?? ''
  return `${day} ${month} ${year}`
}
