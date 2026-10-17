// Source guard for the /demo primitives (plan §6.5 port rules + the demo hard rules). The copy
// check already denies the motion and icon packages transitively; this pins the rest per file.
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const DIR = dirname(fileURLToPath(import.meta.url))
const files = readdirSync(DIR)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f))
  .map((f) => ({ name: f, code: readFileSync(join(DIR, f), "utf8") }))

/** Source without comments, so prose about a rule does not trip it. */
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")

const FORBIDDEN_CODE: readonly [string, RegExp][] = [
  ["motion / icon packages", /from\s+["'](framer-motion|motion(\/[^"']*)?|lucide-react)["']/],
  ["raw timers (use the demo scheduler)", /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/],
  ["randomness or wall time", /\b(Math\.random|Date\.now|new Date)\b/],
  ["browser storage", /\b(localStorage|sessionStorage)\b/],
  ["viewport queries (use the shell's ResizeObserver)", /\bmatchMedia\b/],
  ["position: fixed in a style", /position:\s*["']fixed/],
]

/** Class tokens: the words inside every string literal and template. */
const tokensOf = (src: string) =>
  [...src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].flatMap((m) => (m[1] ?? m[2] ?? "").split(/\s+/)).filter(Boolean)

const FORBIDDEN_CLASS: readonly [string, RegExp][] = [
  ["position: fixed", /^([\w@[\]-]+:)*fixed$/],
  ["radius", /^([\w@[\]-]+:)*rounded(-.+)?$/],
  ["viewport units", /\d(d|s|l)?v[hw]\b|^([\w@[\]-]+:)*(min-|max-)?[hw]-screen$/],
  ["viewport breakpoints (use @min-[1024px]: / @max-*)", /(^|:)(max-)?(sm|md|lg|xl|2xl):/],
]

describe("demo/ui sources follow the port rules", () => {
  it("found the primitives", () => {
    expect(files.length).toBeGreaterThanOrEqual(20)
  })

  for (const { name, code } of files) {
    it(`${name} uses none of the forbidden APIs or classes`, () => {
      const src = strip(code)
      for (const [why, re] of FORBIDDEN_CODE) expect({ why, hit: re.test(src) }).toEqual({ why, hit: false })
      const tokens = tokensOf(src)
      for (const [why, re] of FORBIDDEN_CLASS) {
        expect({ why, hits: tokens.filter((t) => re.test(t)) }).toEqual({ why, hits: [] })
      }
    })

    it(`${name} imports only React, its siblings, the class helper, the copy hook and the demo copy`, () => {
      const specs = [...code.matchAll(/^\s*(?:import|export)[^"']*from\s+["']([^"']+)["']/gm)].map((m) => m[1])
      for (const s of specs) expect(s).toMatch(/^(react|\.\/[\w-]+|@\/lib\/utils|@\/hooks\/use-copy|\.\.\/copy\/core)$/)
    })

    it(`${name} is a client module only when it holds state or attaches its own handlers`, () => {
      const src = strip(code)
      const client = /^"use client"/.test(code)
      const needsClient = /\buse(State|Ref|Effect|LayoutEffect|Copy|SyncExternalStore|Callback|Memo|Reducer|Id)\s*\(/.test(src) || /\son[A-Z][A-Za-z]*=\{/.test(src)
      expect({ name, client }).toEqual({ name, client: needsClient })
    })
  }
})
