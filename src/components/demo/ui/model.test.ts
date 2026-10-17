import { describe, expect, it } from "vitest"
import { attentionCount, attentionLabel, attentionText } from "./attention"
import { buttonClasses, showsArrow } from "./button-classes"
import { FIELD_CLASS, FOCUS_RING, FOCUS_RING_OFFSET } from "./classes"
import { DEMO_NOTE_TEXT, DEMO_TAG_TEXT, demoNoteText } from "./demo"
import { classifyDiffLine, diffLines, diffStats } from "./diff"
import { nextEnabled, segmentedKeyTarget, segmentedTabStop } from "./segmented-keys"
import { SPARK_GAP, SPARK_GLYPHS, sparkGlyphs, sparkPath, sparkRange } from "./spark"
import { visibleSpecRows, type SpecRow } from "./spec"
import { DOT_CLASS, DOT_LABEL, DOT_STATES, dotLabelEmphasis, isDotState, statusDotText } from "./status"
import { isPinnedToBottom, lineTone } from "./terminal-lines"

describe("status dot model", () => {
  it("labels every state with the real dashboard's words", () => {
    expect(DOT_LABEL).toEqual({ live: "LIVE", unset: "NOT SET", error: "ERROR", starting: "STARTING", unknown: "UNKNOWN" })
    expect(DOT_STATES).toHaveLength(5)
    for (const s of DOT_STATES) expect(DOT_LABEL[s].length).toBeGreaterThan(0)
  })

  it("puts status colours on the dot only, transitional = grey + blink, stale = hollow grey", () => {
    expect(DOT_CLASS.live).toBe("bg-status-live")
    expect(DOT_CLASS.error).toBe("bg-status-error")
    expect(DOT_CLASS.starting).toContain("bg-status-unset")
    expect(DOT_CLASS.starting).toContain("animate-blink")
    expect(DOT_CLASS.unknown).toBe("border border-status-unset")
  })

  it("names the thing in the screen-reader text when the label is hidden", () => {
    expect(statusDotText("live", "Local AI agent")).toBe("Local AI agent: LIVE")
    expect(statusDotText("unset")).toBe("NOT SET")
    expect(statusDotText("starting", "")).toBe("STARTING")
  })

  it("emphasises settled states only and validates state values", () => {
    expect(dotLabelEmphasis("live")).toBe("strong")
    expect(dotLabelEmphasis("error")).toBe("strong")
    expect(dotLabelEmphasis("starting")).toBe("muted")
    expect(isDotState("live")).toBe(true)
    expect(isDotState("ok")).toBe(false)
    expect(isDotState(1)).toBe(false)
  })
})

describe("spec rows", () => {
  const rows: SpecRow[] = [
    { label: "Runs on", value: "laptop" },
    { label: "Mode", value: "x", minMode: "simple" },
    { label: "Port", value: "y", minMode: "advanced" },
  ]
  it("hides advanced rows in simple mode and shows everything otherwise", () => {
    expect(visibleSpecRows(rows, "simple").map((r) => r.label)).toEqual(["Runs on", "Mode"])
    expect(visibleSpecRows(rows, "advanced")).toHaveLength(3)
    expect(visibleSpecRows(rows)).toHaveLength(3)
  })
})

describe("button classes", () => {
  it("is zero-radius, 44 px tall and carries the offset focus ring", () => {
    const c = buttonClasses()
    expect(c).toContain("min-h-11")
    expect(c).not.toMatch(/\brounded/)
    for (const token of FOCUS_RING_OFFSET.split(" ")) expect(c).toContain(token)
  })

  it("inverts the primary variant and lets a caller class win", () => {
    expect(buttonClasses({ variant: "primary" })).toContain("bg-foreground text-background")
    expect(buttonClasses({ variant: "destructive" })).toContain("text-destructive")
    expect(buttonClasses({ size: "sm", className: "px-1" })).toContain("px-1")
    expect(buttonClasses({ size: "sm", className: "px-1" })).not.toContain("px-3")
  })

  it("shows the arrow on primary by default, explicit arrow wins", () => {
    expect(showsArrow("primary")).toBe(true)
    expect(showsArrow("default")).toBe(false)
    expect(showsArrow("primary", false)).toBe(false)
    expect(showsArrow("destructive", true)).toBe(true)
  })

  it("keeps the shared ring and field look free of viewport queries", () => {
    expect(FOCUS_RING).toBe("focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none")
    expect(FIELD_CLASS).toContain("@min-[768px]:text-sm")
    expect(FIELD_CLASS).not.toMatch(/(^|\s)md:/)
  })
})

describe("segmented keys", () => {
  const none = [false, false, false]
  it("wraps and skips disabled options", () => {
    expect(nextEnabled(none, 2, 1)).toBe(0)
    expect(nextEnabled(none, 0, -1)).toBe(2)
    expect(nextEnabled([false, true, false], 0, 1)).toBe(2)
    expect(nextEnabled([true, true, true], 1, 1)).toBe(1)
  })

  it("maps arrows logically (RTL flips left/right only) and Home/End to the ends", () => {
    expect(segmentedKeyTarget("ArrowRight", 0, none)).toBe(1)
    expect(segmentedKeyTarget("ArrowRight", 0, none, true)).toBe(2)
    expect(segmentedKeyTarget("ArrowLeft", 0, none)).toBe(2)
    expect(segmentedKeyTarget("ArrowLeft", 0, none, true)).toBe(1)
    expect(segmentedKeyTarget("ArrowDown", 1, none, true)).toBe(2)
    expect(segmentedKeyTarget("ArrowUp", 1, none, true)).toBe(0)
    expect(segmentedKeyTarget("Home", 2, [true, false, false])).toBe(1)
    expect(segmentedKeyTarget("End", 0, [false, false, true])).toBe(1)
    expect(segmentedKeyTarget("Enter", 0, none)).toBeNull()
    expect(segmentedKeyTarget("Home", 0, [true, true])).toBe(-1)
  })

  it("puts the tab stop on the selected option, else the first enabled one", () => {
    expect(segmentedTabStop(1, none)).toBe(1)
    expect(segmentedTabStop(-1, [true, false, false])).toBe(1)
    expect(segmentedTabStop(0, [true, false, false])).toBe(1)
    expect(segmentedTabStop(-1, [true, true])).toBe(-1)
  })
})

describe("mini terminal lines", () => {
  it("brightens typed commands only", () => {
    expect(lineTone("$ check this node")).toBe("command")
    expect(lineTone("checking health")).toBe("output")
    expect(lineTone("")).toBe("output")
  })

  it("follows the tail only near the bottom", () => {
    expect(isPinnedToBottom(1000, 800, 200)).toBe(true)
    expect(isPinnedToBottom(1000, 780, 200)).toBe(true)
    expect(isPinnedToBottom(1000, 700, 200)).toBe(false)
  })
})

describe("sparkline", () => {
  it("maps a series onto the eight block glyphs, low to high", () => {
    expect(sparkGlyphs([0, 7])).toBe("▁█")
    expect(sparkGlyphs([0, 1, 2, 3, 4, 5, 6, 7])).toBe(SPARK_GLYPHS)
    expect(sparkGlyphs([10, 40, 70, 100, 55], 0, 100)).toHaveLength(5)
  })

  it("renders a flat series mid-height and gaps as a middle dot", () => {
    expect(sparkGlyphs([4, 4, 4])).toBe("▄▄▄")
    expect(sparkGlyphs([1, Number.NaN, 5])).toBe(`▁${SPARK_GAP}█`)
    expect(sparkGlyphs([Number.NaN])).toBe(SPARK_GAP)
    expect(sparkGlyphs([])).toBe("")
  })

  it("clamps values outside an explicit range", () => {
    expect(sparkGlyphs([-50, 150], 0, 100)).toBe("▁█")
    expect(sparkRange([3, 9])).toEqual({ lo: 3, hi: 9 })
    expect(sparkRange([3, 9], 0)).toEqual({ lo: 0, hi: 9 })
    expect(sparkRange([Number.NaN])).toBeNull()
  })

  it("draws a line path with high values at the top", () => {
    expect(sparkPath([0, 10], { width: 100, height: 20, pad: 0 })).toBe("M0 20L100 0")
    expect(sparkPath([0, 5, 10], { width: 100, height: 20, pad: 1 })).toBe("M0 19L50 10L100 1")
    expect(sparkPath([])).toBe("")
    expect(sparkPath([Number.NaN, Number.NaN])).toBe("")
  })

  it("breaks the line at gaps and gives lone points a visible tick", () => {
    expect(sparkPath([0, 10, Number.NaN, 0, 10], { width: 100, height: 20, pad: 0 })).toBe("M0 20L25 0M75 20L100 0")
    expect(sparkPath([7], { width: 100, height: 20, pad: 0 })).toBe("M0 10H100")
    const lastAlone = sparkPath([0, Number.NaN, 10], { width: 100, height: 20, pad: 0 })
    expect(lastAlone).toBe("M0 20H5M100 0H95")
  })

  it("only uses glyphs the body font draws", () => {
    for (const ch of SPARK_GLYPHS) {
      const cp = ch.codePointAt(0) ?? 0
      expect(cp >= 0x2580 && cp <= 0x259f).toBe(true)
    }
  })
})

describe("diff", () => {
  it("classifies unified-diff lines", () => {
    expect(classifyDiffLine("@@ -1,3 +1,4 @@")).toBe("hunk")
    expect(classifyDiffLine("+++ b/radio")).toBe("meta")
    expect(classifyDiffLine("--- a/radio")).toBe("meta")
    expect(classifyDiffLine("diff a b")).toBe("meta")
    expect(classifyDiffLine("index 1..2")).toBe("meta")
    expect(classifyDiffLine("+retry = 3")).toBe("add")
    expect(classifyDiffLine("-retry = 1")).toBe("del")
    expect(classifyDiffLine(" region = auto")).toBe("ctx")
    expect(classifyDiffLine("")).toBe("ctx")
  })

  it("normalises line endings, drops one trailing newline and counts changes", () => {
    expect(diffLines("a\r\nb\n")).toEqual(["a", "b"])
    expect(diffLines("a\n\n")).toEqual(["a", ""])
    expect(diffStats("--- a\n+++ b\n@@ x @@\n-old\n+new\n+more\n same\n")).toEqual({ added: 2, removed: 1 })
  })
})

describe("attention badge", () => {
  it("reads in words and caps the visible count", () => {
    expect(attentionLabel(1)).toBe("1 item needs you")
    expect(attentionLabel(3)).toBe("3 items need you")
    expect(attentionText(7)).toBe("7")
    expect(attentionText(100)).toBe("99+")
  })

  it("renders nothing for zero, negatives, fractions below one and non-numbers", () => {
    expect(attentionCount(0)).toBeNull()
    expect(attentionCount(-2)).toBeNull()
    expect(attentionCount(0.5)).toBeNull()
    expect(attentionCount(Number.NaN)).toBeNull()
    expect(attentionCount(Number.POSITIVE_INFINITY)).toBeNull()
    expect(attentionCount(2.7)).toBe(2)
  })
})

describe("demo markers", () => {
  it("uses the plan's words", () => {
    expect(DEMO_TAG_TEXT).toBe("DEMO")
    expect(DEMO_NOTE_TEXT).toEqual({ message: "demo message", reply: "demo reply", node: "demo node" })
    expect(demoNoteText()).toBe("demo message")
    expect(demoNoteText("reply")).toBe("demo reply")
  })
})
