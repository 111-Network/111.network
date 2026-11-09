import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { measureRoute } from "./check-budget.mjs"
import { loadInputs } from "./check-copy.mjs"
import { findPrerendered, listPrerendered, prerenderRoots } from "./next-output.mjs"

function write(dir, rel, text) {
  const file = path.join(dir, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

/** A fake .next tree: `classic` writes server/app, `adapter` writes server/route-cache. */
function fakeNext({ classic = false, adapter = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "next-output-"))
  const home = '<html><body><p>Home</p><script src="/_next/static/chunks/a.js"></script></body></html>'
  write(dir, "static/chunks/a.js", "console.log(1)")
  if (classic) {
    write(dir, "server/app/index.html", home)
    write(dir, "server/app/terms.html", "<html><body>Terms</body></html>")
    write(dir, "server/app/llms.txt.body", "V.0.0.6 Experimental")
    write(dir, "server/app/llms.txt.meta", JSON.stringify({ headers: { "content-type": "text/plain" } }))
  }
  if (adapter) {
    write(dir, "server/app/page.js", "// route code, no prerendered files here")
    write(dir, `server/route-cache/APP_PAGE/${"a".repeat(64)}/$/index.html`, home)
    write(dir, `server/route-cache/APP_PAGE/${"b".repeat(64)}/$/terms.html`, "<html><body>Terms</body></html>")
    write(dir, `server/route-cache/APP_PAGE/${"b".repeat(64)}/$/terms.rsc`, "rsc")
    write(dir, `server/route-cache/APP_ROUTE/${"c".repeat(64)}/$/llms.txt.body`, "V.0.0.6 Experimental")
    write(dir, `server/route-cache/APP_ROUTE/${"c".repeat(64)}/$/llms.txt.meta`, JSON.stringify({ headers: { "content-type": "text/plain" } }))
  }
  return dir
}

describe("prerendered output layouts", () => {
  it("finds nothing in an empty build directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "next-output-"))
    expect(prerenderRoots(dir)).toEqual([])
    expect(listPrerendered(dir, ".html")).toEqual([])
    expect(findPrerendered(dir, "index.html")).toBeUndefined()
  })

  for (const [name, layout] of [
    ["classic (server/app)", { classic: true }],
    ["adapter (server/route-cache, as on the host)", { adapter: true }],
    ["both at once", { classic: true, adapter: true }],
  ]) {
    it(`reads ${name}`, () => {
      const dir = fakeNext(layout)
      expect(listPrerendered(dir, ".html").map((f) => f.rel)).toEqual(["index.html", "terms.html"])
      expect(listPrerendered(dir, ".body").map((f) => f.rel)).toEqual(["llms.txt.body"])
      expect(findPrerendered(dir, "index.html")).toMatch(/index\.html$/)
      expect(findPrerendered(dir, "nope.html")).toBeUndefined()
    })

    it(`loadInputs yields the same routes for ${name}`, () => {
      const dir = fakeNext(layout)
      const { pages, textFiles, built } = loadInputs({ root: dir, nextDir: dir })
      expect(built).toBe(true)
      expect(pages.map((p) => p.id)).toEqual(["/", "/terms"])
      expect(textFiles.find((t) => t.id === "/llms.txt")?.text).toBe("V.0.0.6 Experimental")
    })

    it(`measureRoute finds the home page for ${name}`, () => {
      const dir = fakeNext(layout)
      const r = measureRoute(dir, { route: "/", html: "index.html", budgetKB: 10 })
      expect(r.notPrerendered).toBeUndefined()
      expect(r.chunks.map((c) => c.pathname)).toEqual(["/_next/static/chunks/a.js"])
    })
  }

  it("loadInputs still exits 2 when there is no build output", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "next-output-"))
    expect(() => loadInputs({ root: dir, nextDir: path.join(dir, ".next") })).toThrow(/no build output/)
  })
})
