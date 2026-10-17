import { describe, expect, it } from "vitest"
import { createRng } from "@/lib/prng"
import { FIELD_CHARS, FIELD_COLS, FIELD_ROWS, fieldFrame } from "./hero-field-frame"

describe("fieldFrame", () => {
  it("draws rows × cols characters joined by newlines", () => {
    const frame = fieldFrame(createRng("hero-field"))
    const lines = frame.split("\n")
    expect(lines).toHaveLength(FIELD_ROWS)
    for (const line of lines) expect(line).toHaveLength(FIELD_COLS)
  })

  it("is deterministic for a seed and changes frame to frame", () => {
    const a = createRng("hero-field")
    const b = createRng("hero-field")
    const first = fieldFrame(a)
    expect(fieldFrame(b)).toBe(first)
    expect(fieldFrame(a)).not.toBe(first)
  })

  it("uses only the field characters and spaces (printable ASCII)", () => {
    const frame = fieldFrame(createRng(7), 12, 40)
    for (const ch of frame.replace(/\n/g, "")) {
      expect(ch === " " || FIELD_CHARS.includes(ch)).toBe(true)
    }
    expect(/^[\x20-\x7e\n]*$/.test(FIELD_CHARS)).toBe(true)
  })

  it("is denser at the centre than at the corners", () => {
    const rng = createRng("density")
    let centre = 0
    let corner = 0
    for (let n = 0; n < 40; n++) {
      const lines = fieldFrame(rng, 20, 40).split("\n")
      if (lines[10][20] !== " ") centre++
      if (lines[0][0] !== " ") corner++
    }
    expect(centre).toBeGreaterThan(corner)
  })

  it("handles a one-cell field", () => {
    expect(fieldFrame(createRng(1), 1, 1)).toHaveLength(1)
  })
})
