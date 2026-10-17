// Source guard for the demo shell, the view modules and the two entry islands (plan §6.5 port
// rules + the /demo hard rules), file by file. The copy check denies the motion and icon packages
// transitively; this pins the rest: nothing fixed, no viewport units or breakpoints, no raw timers,
// no randomness or wall time, no browser storage, no matchMedia, zero radius.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const SHELL = dirname(fileURLToPath(import.meta.url))
const DEMO = dirname(SHELL)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const isSource = (p: string) => /\.(ts|tsx)$/.test(p) && !/\.test\.ts$/.test(p)
const files = [...walk(SHELL), ...walk(join(DEMO, "views")), join(DEMO, "demo-app.tsx"), join(DEMO, "demo-window.tsx")]
  .filter(isSource)
  .map((p) => ({ name: relative(DEMO, p), code: readFileSync(p, "utf8") }))

/** Source without comments, so prose about a rule does not trip it. */
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")

const FORBIDDEN_CODE: readonly [string, RegExp][] = [
  ["motion / icon packages", /from\s+["'](framer-motion|motion(\/[^"']*)?|lucide-react)["']/],
  ["raw timers (use the demo scheduler)", /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/],
  ["randomness or wall time", /\b(Math\.random|Date\.now|new Date)\b/],
  ["browser storage (the store persists mode and rail)", /\b(localStorage|sessionStorage)\b/],
  ["viewport queries (use the shell's ResizeObserver)", /\bmatchMedia\b/],
  ["position: fixed in a style", /position:\s*["']fixed/],
  ["scrollIntoView (it scrolls the page too; use shell/scroll.ts)", /\.scrollIntoView\s*\(/],
  ["location writes (the store owns the url router)", /\b(location\.hash\s*=|history\.(push|replace)State)/],
]

/** Class tokens: the words inside every string literal and template. */
const tokensOf = (src: string) =>
  [...src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].flatMap((m) => (m[1] ?? m[2] ?? "").split(/\s+/)).filter(Boolean)

const FORBIDDEN_CLASS: readonly [string, RegExp][] = [
  ["position: fixed", /^([\w@[\]-]+:)*fixed$/],
  ["radius", /^([\w@[\]-]+:)*rounded(-.+)?$/],
  ["viewport units", /\d(d|s|l)?v[hw]\b|^([\w@[\]-]+:)*(min-|max-)?[hw]-screen$/],
  ["viewport breakpoints (use @min-[1024px]: / @max-[1024px]:)", /(^|:)(max-)?(sm|md|lg|xl|2xl):/],
]

describe("demo shell and view sources follow the port rules", () => {
  it("found the shell, the views and both islands", () => {
    expect(files.some((f) => f.name === "shell/shell.tsx")).toBe(true)
    expect(files.some((f) => f.name === "views/registry.tsx")).toBe(true)
    expect(files.some((f) => f.name === "views/services/frame.tsx")).toBe(true)
    expect(files.some((f) => f.name === "demo-app.tsx")).toBe(true)
    expect(files.some((f) => f.name === "demo-window.tsx")).toBe(true)
  })

  for (const { name, code } of files) {
    it(`${name} uses none of the forbidden APIs or classes`, () => {
      const src = strip(code)
      for (const [why, re] of FORBIDDEN_CODE) expect({ name, why, hit: re.test(src) }).toEqual({ name, why, hit: false })
      const tokens = tokensOf(src)
      for (const [why, re] of FORBIDDEN_CLASS) expect({ name, why, hits: tokens.filter((t) => re.test(t)) }).toEqual({ name, why, hits: [] })
    })
  }

  it("the two islands are client modules; the pure helpers stay React-free", () => {
    const byName = new Map(files.map((f) => [f.name, f.code]))
    expect(byName.get("demo-app.tsx")).toMatch(/^"use client"/)
    expect(byName.get("demo-window.tsx")).toMatch(/^"use client"/)
    for (const pure of ["shell/nav.ts", "shell/layout.ts", "shell/route-keys.ts", "shell/announcer.ts", "shell/service-page.ts", "shell/frame-ids.ts", "shell/copy.ts", "shell/select.ts"]) {
      expect({ pure, react: /from\s+["']react(-dom)?["']/.test(byName.get(pure) ?? "react") }).toEqual({ pure, react: false })
    }
  })
})
