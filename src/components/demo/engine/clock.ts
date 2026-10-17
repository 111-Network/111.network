// Virtual time, formatted by hand (plan §6.5: a fixed epoch, never the visitor's clock, no Intl
// date of "now"). A virtual time is a number of ms since the epoch below; sample data from before
// the demo opened is negative ("-12 * MIN" is 08:48).

export const SEC = 1000
export const MIN = 60 * SEC
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

/** The demo opens at 09:00 on 17 Oct 2026, local time of the sample world. */
export const DEMO_EPOCH = { year: 2026, month: 10, day: 17, hour: 9, minute: 0 } as const

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

const two = (n: number): string => String(n).padStart(2, "0")

/** Seconds since midnight of the epoch day (can be negative or beyond one day). */
function secondsOfDay(t: number): number {
  return DEMO_EPOCH.hour * 3600 + DEMO_EPOCH.minute * 60 + Math.floor(t / SEC)
}

const mod = (n: number, m: number): number => ((n % m) + m) % m

/** "09:12". Wraps at midnight. */
export function formatClock(t: number): string {
  const s = mod(secondsOfDay(t), 86_400)
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}`
}

/** "09:12:05" (activity lines, logs). */
export function formatClockSeconds(t: number): string {
  const s = mod(secondsOfDay(t), 86_400)
  return `${formatClock(t)}:${two(s % 60)}`
}

/** "17 Oct" for the epoch day, "16 Oct" for yesterday, and so on (month lengths of 2026). */
export function formatDay(t: number): string {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let month = DEMO_EPOCH.month - 1
  let day = DEMO_EPOCH.day + Math.floor(secondsOfDay(t) / 86_400)
  while (day < 1) {
    month = mod(month - 1, 12)
    day += lengths[month]
  }
  while (day > lengths[month]) {
    day -= lengths[month]
    month = mod(month + 1, 12)
  }
  return `${day} ${MONTHS[month]}`
}

/** "45 s", "12 min", "3 h 5 min", "2 d 4 h" (real `formatDuration`, in ms). */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / SEC))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 === 0 ? `${h} h` : `${h} h ${m % 60} min`
  const d = Math.floor(h / 24)
  return h % 24 === 0 ? `${d} d` : `${d} d ${h % 24} h`
}

/** "just now", "40 s ago", "3 min ago", "2 h ago", "5 d ago" (real `agoText`). A future time reads "just now". */
export function agoText(at: number, now: number): string {
  const sec = Math.floor((now - at) / SEC)
  if (sec < 10) return "just now"
  if (sec < 60) return `${sec} s ago`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

/** "since 3 h ago". */
export const sinceText = (at: number, now: number): string => `since ${agoText(at, now)}`
