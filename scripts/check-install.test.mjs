import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { headUrl, inspectInstallConstants } from "./check-install.mjs"
import { readSiteConstants } from "./site-constants.mjs"

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "site.ts")

describe("readSiteConstants", () => {
  it("reads literals, `as const` objects, annotated booleans and ?? defaults", () => {
    const code = [
      'export const A = "a"',
      "export const B: boolean = false",
      'export const C = { x: "1", y: "2" } as const',
      'export const D = process.env.X ?? "fallback"',
      "export const E = 3",
      "const HIDDEN = 'no'",
      "export const F = someCall()",
    ].join("\n")
    expect(readSiteConstants(code)).toEqual({ A: "a", B: false, C: { x: "1", y: "2" }, D: "fallback", E: 3 })
  })

  it("reads the real site.ts", () => {
    const c = readSiteConstants(fs.readFileSync(SITE, "utf8"))
    expect(typeof c.INSTALL_LIVE).toBe("boolean")
    expect(c.SITE_VERSION).toBe("V.0.0.6 Experimental")
    expect(c.INSTALL_URL).toMatch(/^https:\/\//)
  })
})

describe("check-install", () => {
  it("keeps every install command on INSTALL_URL in the real site.ts", () => {
    const { problems } = inspectInstallConstants(readSiteConstants(fs.readFileSync(SITE, "utf8")))
    expect(problems).toEqual([])
  })

  it("flags a command that drifted from INSTALL_URL", () => {
    const { problems } = inspectInstallConstants({
      INSTALL_LIVE: false,
      INSTALL_URL: "https://install.example/install.sh",
      INSTALL_COMMANDS: { host: "curl -fsSL https://other.example/i.sh | sh" },
    })
    expect(problems).toHaveLength(1)
  })

  it("refuses unreadable constants", () => {
    expect(() => inspectInstallConstants({ INSTALL_LIVE: "yes" })).toThrow(/INSTALL_LIVE/)
  })

  it("passes only on a 200 answer", async () => {
    const answer = (status) => async () => ({ status })
    expect((await headUrl("https://x.example", { fetchImpl: answer(200) })).ok).toBe(true)
    expect((await headUrl("https://x.example", { fetchImpl: answer(404) })).ok).toBe(false)
    const down = async () => {
      throw new Error("ENOTFOUND")
    }
    expect(await headUrl("https://x.example", { fetchImpl: down })).toEqual({ ok: false, error: "ENOTFOUND" })
  })
})
