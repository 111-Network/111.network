#!/usr/bin/env node
/**
 * Glyph coverage check (docs/DESIGN.md "Glyphs"). The body font is the
 * Geist Mono variable face. A character it does not contain is drawn from a
 * fallback font with a different advance width, which breaks the monospace
 * grid of the ASCII art, the terminal and the state glyphs. So every string
 * literal, template text and JSX text in src/**\/*.{ts,tsx} may only use code
 * points the font covers.
 *
 * Covered, in short: printable ASCII, Latin-1, general punctuation (– — ‘ ’ “ ” • … ·),
 * arrows ← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙, box drawing U+2500–257F, blocks U+2580–259F
 * (█ ▀ ▄ ▌ ▐ ░ ▒ ▓) and ▲ △ ▶ ▷ ▼ ▽ ◀ ◁ ◊ ○ ◌ ●.
 * NOT covered: ■ □ ▪ ▫ ▸ ◂ ◐ ◑ ✓ ✗ ★ ☐ ☑ … : draw indicators (pips, grades,
 * node markers, strip cells) as CSS squares instead.
 *
 * Run by `pnpm test` (scripts/check-glyphs.test.mjs scans the real tree), or
 * by hand: node scripts/check-glyphs.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { extractSourceStrings, isTestFile, loadInputs, matchesId } from "./check-copy.mjs"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
export const FONT_FILE = path.resolve(SCRIPT_DIR, "..", "node_modules", "geist", "dist", "fonts", "geist-mono", "GeistMono-Variable.ttf")

/**
 * cmap of GeistMono-Variable (geist 1.7.0), from
 *   fc-query --format='%{charset}\n' node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.ttf
 * Regenerate after a geist upgrade (the test compares it when fc-query is installed).
 */
export const GEIST_MONO_CHARSET =
  "20-7e a0-ac ae-113 116-12b 12e-131 134-137 139-13e 141-148 14a-14d 150-17e 18f 192 1a0-1a1 1af-1b0 1cd-1ce 1e4-1e9 218-21b 237 259 2b9 2bc 2c6-2c8 2d8-2dd 300-304 306-30c 312 31b 323 326-328 335-338 39b 3a9 3bb-3bc 3c0 400-45f 462-463 46a-46b 472-475 490-493 496-497 49a-49b 4a2-4a3 4ae-4b3 4b6-4b7 4ba-4bb 4c0 4cf 4d8-4d9 4e2-4e3 4e8-4e9 4ee-4ef e3f 1e20-1e21 1e80-1e85 1e9e 1ea0-1ef9 2013-2014 2018-201a 201c-201e 2020-2022 2026 2030 2032-2033 2039-203a 2044 2070 2074-2079 2080-2089 20aa 20ac 20b1 20b4 20b9 20bd 2107 2116-2117 2122 2153-2155 215b-215e 2190-2199 219d 21a9-21aa 21b0-21b1 21b3-21b5 21e4-21e5 21e7 2202 2206 220f 2211-2212 221a 221e 222b 2236 2248 2260 2264-2265 2326-2327 232b 23ce 240b-240c 2423 2460-2468 24ea 24ff-259f 25b2-25b3 25b6-25b7 25bc-25bd 25c0-25c1 25ca-25cc 25cf 2776-277e 3003 301c a78b-a78c f8ff"

/**
 * Characters a file may hold although the font lacks them, because they are
 * never rendered. Keep this list tiny and say why.
 */
export const INTERNAL_GLYPHS = {
  // The README layer table (✓ runs · ◐ partly · — not run), transcribed verbatim
  // into the internal device → category map; only the parsed values are exported.
  "src/lib/devices.ts": "✓◐",
}

/** "20-7e a0 …" → [[0x20, 0x7e], [0xa0, 0xa0], …] */
export function parseCharset(charset) {
  return charset
    .trim()
    .split(/\s+/)
    .map((part) => {
      const [lo, hi = lo] = part.split("-").map((h) => parseInt(h, 16))
      return [lo, hi]
    })
}

export const COVERED = parseCharset(GEIST_MONO_CHARSET)

export function isCovered(cp, ranges = COVERED) {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [a, b] = ranges[mid]
    if (cp < a) hi = mid - 1
    else if (cp > b) lo = mid + 1
    else return true
  }
  return false
}

const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`

/**
 * Uncovered characters in the string literals of `sources` (Map id → code).
 * `skip`: globs to leave out (legacy files); `allow`: { id: "chars" } (INTERNAL_GLYPHS).
 */
export function findUncoveredGlyphs(sources, { skip = [], allow = INTERNAL_GLYPHS, ranges = COVERED } = {}) {
  const out = []
  for (const [id, code] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    if (!/\.tsx?$/.test(id) || id.endsWith(".d.ts") || isTestFile(id)) continue
    if (skip.some((p) => matchesId(p, id))) continue
    const allowed = new Set(allow[id] ?? "")
    for (const lit of extractSourceStrings(id, code)) {
      for (const ch of new Set(lit.text)) {
        const cp = ch.codePointAt(0)
        if (isCovered(cp, ranges) || allowed.has(ch)) continue
        out.push({ file: `${id}:${lit.line}`, char: ch, cp: hex(cp), text: lit.text })
      }
    }
  }
  return out
}

/** Legacy skipSource globs of copy-denylist.json (the legacy frame is replaced, not fixed). */
export function legacySkips(configFile = path.join(SCRIPT_DIR, "copy-denylist.json")) {
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"))
  return (config.legacy?.skipSource ?? []).map((s) => s.path)
}

export function formatGlyphReport(found) {
  if (!found.length) return "check-glyphs: OK"
  const lines = found.map((f) => `ERROR ${f.cp} "${f.char}" at ${f.file}: ${JSON.stringify(f.text.slice(0, 80))} · not in Geist Mono; use a CSS square or a covered glyph (DESIGN.md "Glyphs")`)
  lines.push(`check-glyphs: FAILED, ${found.length} uncovered character(s)`)
  return lines.join("\n")
}

function main() {
  const { sources } = loadInputs({ srcOnly: true })
  const found = findUncoveredGlyphs(sources, { skip: legacySkips() })
  ;(found.length ? console.error : console.log)(formatGlyphReport(found))
  process.exitCode = found.length ? 1 : 0
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main()
