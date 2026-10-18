// Sparkline math (React-free). Real source: os/40-interface/ui/src/components/sparkline.tsx.

/** Eight block heights, low to high (all inside the body font's block range). */
export const SPARK_GLYPHS = "▁▂▃▄▅▆▇█"

/** Placeholder for a missing (non-finite) sample. */
export const SPARK_GAP = "·"

/** Normalised 0..1 position of `v` between lo and hi; a flat range sits at the middle. */
function level(v: number, lo: number, hi: number): number {
  const span = hi - lo
  if (span <= 0) return 0.5
  return Math.min(1, Math.max(0, (v - lo) / span))
}

/** The series' range: explicit bounds win, otherwise the finite values' own min and max. */
export function sparkRange(values: readonly number[], min?: number, max?: number): { lo: number; hi: number } | null {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return null
  return { lo: min ?? Math.min(...finite), hi: max ?? Math.max(...finite) }
}

/**
 * Map numbers to block glyphs, scaled between `min` and `max` (default: the data's own range).
 * A flat series renders mid-height (▄); non-finite values render as a middle dot.
 */
export function sparkGlyphs(values: readonly number[], min?: number, max?: number): string {
  const range = sparkRange(values, min, max)
  if (!range) return values.map(() => SPARK_GAP).join("")
  return values
    .map((v) => {
      if (!Number.isFinite(v)) return SPARK_GAP
      if (range.hi - range.lo <= 0) return SPARK_GLYPHS.charAt(3)
      return SPARK_GLYPHS.charAt(Math.round(level(v, range.lo, range.hi) * (SPARK_GLYPHS.length - 1)))
    })
    .join("")
}

/** Options of sparkPath. */
export interface SparkPathOptions {
  /** viewBox width. Default 100. */
  width?: number
  /** viewBox height. Default 20. */
  height?: number
  /** Inset from the top and bottom edges so a 1-unit stroke is not clipped. Default 1. */
  pad?: number
  min?: number
  max?: number
}

const round = (n: number): number => Math.round(n * 100) / 100

/**
 * SVG path data for a line sparkline: samples evenly spaced across the width, high values at the
 * top. A non-finite sample breaks the line (the next point starts a new `M`); a single sample, or a
 * run of one between gaps, draws a short flat tick so it stays visible. Empty input returns "".
 */
export function sparkPath(values: readonly number[], opts: SparkPathOptions = {}): string {
  const { width = 100, height = 20, pad = 1, min, max } = opts
  const range = sparkRange(values, min, max)
  if (!range) return ""
  const n = values.length
  const step = n > 1 ? width / (n - 1) : 0
  const tick = n > 1 ? Math.min(step / 2, width / 20) : width
  const y = (v: number) => round(height - pad - level(v, range.lo, range.hi) * (height - 2 * pad))
  // A lone point gets a flat tick, drawn leftwards when it sits at the right edge.
  const tickTo = (x: number) => `H${round(x + tick <= width ? x + tick : x - tick)}`
  const parts: string[] = []
  let run = 0
  let lastX = 0
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) {
      if (run === 1) parts.push(tickTo(lastX))
      run = 0
      return
    }
    const x = round(i * step)
    parts.push(`${run === 0 ? "M" : "L"}${x} ${y(v)}`)
    run += 1
    lastX = x
  })
  if (run === 1) parts.push(tickTo(lastX))
  return parts.join("")
}
