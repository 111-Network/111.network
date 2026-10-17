import type { Rng } from "@/lib/prng"

// The hero's ASCII background field (plan §2.1 V1), as a pure string renderer.
// Characters are dense at the centre and thin out toward the edges.

/** Characters the field draws from (printable ASCII only). */
export const FIELD_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=-~^"

/** Field size in characters. */
export const FIELD_ROWS = 30
export const FIELD_COLS = 80

/** One frame redraw at most every this many milliseconds. */
export const FIELD_FRAME_MS = 120

/**
 * One frame: `rows` lines of `cols` characters joined by "\n". Each cell is a
 * character with a chance that falls with its distance from the centre, else a
 * space. Deterministic for a given generator state.
 */
export function fieldFrame(rng: Rng, rows: number = FIELD_ROWS, cols: number = FIELD_COLS, chars: string = FIELD_CHARS): string {
  const lines: string[] = []
  const halfRows = rows / 2
  const halfCols = cols / 2
  for (let r = 0; r < rows; r++) {
    let line = ""
    const dy = halfRows === 0 ? 0 : Math.abs(r - halfRows) / halfRows
    for (let c = 0; c < cols; c++) {
      const dx = halfCols === 0 ? 0 : Math.abs(c - halfCols) / halfCols
      const dist = Math.sqrt(dx * dx + dy * dy)
      line += rng() > dist * 0.7 ? chars[Math.floor(rng() * chars.length)] : " "
    }
    lines.push(line)
  }
  return lines.join("\n")
}
