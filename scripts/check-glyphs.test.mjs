import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { loadInputs } from "./check-copy.mjs"
import { FONT_FILE, GEIST_MONO_CHARSET, findUncoveredGlyphs, formatGlyphReport, isCovered, legacySkips } from "./check-glyphs.mjs"

function fcQueryCharset() {
  try {
    if (!fs.existsSync(FONT_FILE)) return null
    return execFileSync("fc-query", ["--format=%{charset}\n", FONT_FILE], { encoding: "utf8" }).split("\n")[0].trim()
  } catch {
    return null
  }
}

const live = fcQueryCharset()

describe("Geist Mono coverage", () => {
  it("covers box drawing, blocks, arrows and the plan's safe shapes", () => {
    for (const ch of "─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣█▀▄▌▐░▒▓←↑→↓↔·•…–—▲△▶▷▼▽◀◁◊○◌●×©") expect(isCovered(ch.codePointAt(0)), ch).toBe(true)
  })

  it("does not cover the squares, check marks and half circles", () => {
    for (const ch of "■□▪▫▸◂◐◑✓✗★☐☑") expect(isCovered(ch.codePointAt(0)), ch).toBe(false)
  })

  it.skipIf(live === null)("matches the installed font's cmap (regenerate GEIST_MONO_CHARSET after a geist upgrade)", () => {
    expect(GEIST_MONO_CHARSET).toBe(live)
  })
})

describe("findUncoveredGlyphs", () => {
  it("flags uncovered characters in literals, honours allow and skip", () => {
    const sources = new Map([
      ["src/a.tsx", 'export const A = () => <p>{"■".repeat(3)} ok █░</p>'],
      ["src/lib/devices.ts", 'const T = "✓◐—"; export const L = "✓ done"'],
      ["src/legacy/x.tsx", 'export const X = "■"'],
      ["src/a.test.ts", 'it("■", () => {})'],
    ])
    const found = findUncoveredGlyphs(sources, { skip: ["src/legacy/**"], allow: { "src/lib/devices.ts": "◐" } })
    expect(found.map((f) => `${f.cp}@${f.file}`)).toEqual(["U+25A0@src/a.tsx:1", "U+2713@src/lib/devices.ts:1", "U+2713@src/lib/devices.ts:1"])
    expect(formatGlyphReport(found)).toMatch(/FAILED, 3/)
  })
})

describe("src tree", () => {
  it("uses only glyphs the body font has", () => {
    const { sources } = loadInputs({ srcOnly: true })
    const found = findUncoveredGlyphs(sources, { skip: legacySkips() })
    expect(found, formatGlyphReport(found)).toEqual([])
  })
})
