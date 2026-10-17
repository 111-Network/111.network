import { describe, expect, it } from "vitest"
import {
  DESKTOP_QUERY,
  READING_LINE,
  SPY_ROOT_MARGIN,
  isPlainClick,
  layerAnchorLabel,
  pickActive,
  readoutShort,
  segmentFills,
} from "./nav-model"

describe("scroll-spy band", () => {
  it("is a 1% band at the reading line", () => {
    expect(SPY_ROOT_MARGIN).toBe("-30% 0px -69% 0px")
    expect(READING_LINE).toBe(0.3)
  })

  it("picks the deepest layer in the band, or null", () => {
    expect(pickActive([])).toBeNull()
    expect(pickActive([3])).toBe(3)
    expect(pickActive(new Set([2, 3]))).toBe(3)
    expect(pickActive([0])).toBe(0)
    expect(pickActive([9, 4])).toBe(9)
  })

  it("ignores numbers that are not layers", () => {
    expect(pickActive([10, -1, 2.5])).toBeNull()
    expect(pickActive([10, 1])).toBe(1)
  })
})

describe("segmentFills", () => {
  const line = 300

  it("returns ten values", () => {
    expect(segmentFills([], line)).toEqual(Array(10).fill(0))
  })

  it("fills passed sections, part-fills the current one, leaves the rest empty", () => {
    const boxes = Array.from({ length: 10 }, (_, i) => ({ top: -1000 + i * 500, height: 500 }))
    // Section 2 spans 0..500: the line at 300 is 60% through it.
    expect(segmentFills(boxes, line)).toEqual([1, 1, 0.6, 0, 0, 0, 0, 0, 0, 0])
  })

  it("reads a missing section as 0 and a zero-height one as passed or not", () => {
    const boxes = [null, { top: 100, height: 0 }, { top: 400, height: 0 }]
    expect(segmentFills(boxes, line).slice(0, 3)).toEqual([0, 1, 0])
  })

  it("rounds to 1/1000", () => {
    const fills = segmentFills([{ top: 0, height: 900 }], line)
    expect(fills[0]).toBe(0.333)
  })
})

describe("readouts", () => {
  it("short: L<n>/9", () => {
    expect(readoutShort(3)).toBe("L3/9")
    expect(readoutShort(0)).toBe("L0/9")
    expect(readoutShort(null)).toBe("L–/9")
  })

  it("anchor labels name the layer", () => {
    expect(layerAnchorLabel(3)).toBe("Layer 3: Local Intelligence")
    expect(layerAnchorLabel(0)).toBe("Layer 0: Knowledge")
  })
})

describe("DESKTOP_QUERY", () => {
  it("is Tailwind's lg breakpoint, where the desktop nav takes over from MENU", () => {
    expect(DESKTOP_QUERY).toBe("(min-width: 64rem)")
  })
})

describe("isPlainClick", () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }

  it("accepts a plain primary click", () => {
    expect(isPlainClick(plain)).toBe(true)
  })

  it("leaves modified, secondary and already-handled clicks to the browser", () => {
    expect(isPlainClick({ ...plain, metaKey: true })).toBe(false)
    expect(isPlainClick({ ...plain, ctrlKey: true })).toBe(false)
    expect(isPlainClick({ ...plain, shiftKey: true })).toBe(false)
    expect(isPlainClick({ ...plain, altKey: true })).toBe(false)
    expect(isPlainClick({ ...plain, button: 1 })).toBe(false)
    expect(isPlainClick({ ...plain, defaultPrevented: true })).toBe(false)
  })
})
