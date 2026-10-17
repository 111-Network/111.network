import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { BUDGETS, firstLoadScripts, gzipSize, measureRoute } from "./check-budget.mjs"

describe("measureRoute", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "budget-"))
  fs.mkdirSync(path.join(empty, "server", "app"), { recursive: true })

  it("fails a required route whose HTML is missing and skips a pending one", () => {
    expect(measureRoute(empty, { route: "/", html: "index.html", budgetKB: 1 })).toMatchObject({ notPrerendered: true })
    expect(measureRoute(empty, { route: "/demo", html: "demo.html", budgetKB: 1, pending: true })).toMatchObject({ skipped: true })
  })

  it("keeps the home route required", () => {
    expect(BUDGETS.find((b) => b.route === "/")?.pending).toBeFalsy()
  })
})

describe("firstLoadScripts", () => {
  it("collects first-paint chunks, deduped, without nomodule polyfills", () => {
    const html = [
      '<link rel="stylesheet" href="/_next/static/chunks/a.css"/>',
      '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/main.js"/>',
      '<link rel="preload" as="font" href="/_next/static/media/f.woff2"/>',
      '<link rel="modulepreload" href="/_next/static/chunks/mod.js"/>',
      '<script src="/_next/static/chunks/main.js" async=""></script>',
      '<script src="/_next/static/chunks/page.js?dpl=1" async=""></script>',
      '<script src="/_next/static/chunks/polyfills.js" noModule=""></script>',
      '<script src="https://va.vercel-scripts.com/x.js"></script>',
      "<script>self.__next_f.push([1])</script>",
    ].join("")
    expect(firstLoadScripts(html)).toEqual(["/_next/static/chunks/main.js", "/_next/static/chunks/mod.js", "/_next/static/chunks/page.js"])
  })
})

describe("budgets", () => {
  it("has one entry per route, each with an html file and a positive budget", () => {
    const routes = BUDGETS.map((b) => b.route)
    expect(new Set(routes).size).toBe(routes.length)
    expect(routes).toContain("/")
    for (const b of BUDGETS) {
      expect(b.html).toMatch(/\.html$/)
      expect(b.budgetKB).toBeGreaterThan(0)
    }
  })

  it("measures gzip size", () => {
    expect(gzipSize(Buffer.from("a".repeat(10000)))).toBeLessThan(100)
  })
})
