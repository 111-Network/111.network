import fs from "node:fs"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_CONFIG,
  checkDemoImports,
  compileEntry,
  extractImports,
  extractSourceStrings,
  fillPlaceholders,
  findMatches,
  formatReport,
  htmlToText,
  isTextBody,
  matchesId,
  routeFromBodyPath,
  routeFromHtmlPath,
  runCopyCheck,
} from "./check-copy.mjs"

const hits = (raw, list, text) => findMatches(compileEntry(raw, list), text).map((m) => m.match)
const errors = (result) => result.findings.filter((f) => f.level === "error")
const page = (id, body) => ({ id, file: `${id}.html`, html: `<html><body>${body}</body></html>` })

const W2 = ["Meshtastic", "MeshCore", "Reticulum"].map((term) => ({ term, exactlyOnce: true }))
const W2_LINE = "Works with existing mesh networks and stacks like Meshtastic, MeshCore and Reticulum (examples)."

describe("whole-word matching", () => {
  it("matches whole words only, plus a plural", () => {
    expect(hits("satellite", "text", "radios, satellites and a satellite")).toEqual(["satellites", "satellite"])
    expect(hits("satellite", "text", "subsatellite satelliteX satellite_link")).toEqual([])
    expect(hits("ledger", "text", "ledgerless, pledger")).toEqual([])
  })

  it("lets whitespace in a term match none, but never joins digits", () => {
    expect(hits("64 KB", "text", "max 64 KB or 64KB")).toEqual(["64 KB", "64KB"])
    expect(hits("100 m", "text", "100 m, 100m, 100 ms, 1100 m")).toEqual(["100 m", "100m"])
    expect(hits("Category 1", "text", "Category 1 and Category 10")).toEqual(["Category 1"])
  })

  it("treats dots and hyphens as boundaries", () => {
    expect(hits("0.0.5", "text", "V.0.0.5 · v0.0.5 · 0.0.50 · 0.0.6")).toEqual(["0.0.5"])
    expect(hits("V.0.0.5", "text", "V.0.0.5 Experimental")).toEqual(["V.0.0.5"])
    expect(hits("Wi-Fi Direct", "names", "Wi-Fi, Wi-Fi Direct")).toEqual(["Wi-Fi Direct"])
  })
})

describe("case rules", () => {
  it("text entries ignore case", () => {
    expect(hits("ledger", "text", "Ledger LEDGER ledger")).toHaveLength(3)
  })

  it("names entries are case-sensitive, plus their ALL-CAPS spelling", () => {
    expect(hits("React", "names", "React reacts, react REACT")).toEqual(["React", "REACT"])
    expect(hits("LoRa", "names", "LoRa lora LORA Lora")).toEqual(["LoRa", "LORA"])
    expect(hits("Meshtastic", "names", "MESHTASTIC NODE")).toEqual(["MESHTASTIC"])
    expect(hits("Next.js", "names", "BUILT WITH NEXT.JS")).toEqual(["NEXT.JS"])
    expect(hits({ term: "Rust", upper: false }, "names", "RUST")).toEqual([])
  })

  it("names entries catch version suffixes and CamelCase compounds", () => {
    expect(hits("Qwen", "names", "Qwen3-4B")).toEqual(["Qwen"])
    expect(hits("Llama", "names", "Llama3 and Llamas")).toEqual(["Llama", "Llamas"])
    expect(hits("Gemma", "names", "Gemma2")).toEqual(["Gemma"])
    expect(hits("GPT", "names", "GPT4o GPTs")).toEqual(["GPT"])
    expect(hits("LoRa", "names", "LoRa32 LORA32")).toEqual(["LoRa", "LORA"])
    expect(hits("Meshtastic", "names", "MeshtasticPKI")).toEqual(["Meshtastic"])
    expect(hits("ESP32", "names", "ESP32S3 ESP32-C3")).toEqual(["ESP32", "ESP32"])
    // still whole word: no lowercase continuation, and ALL-CAPS names never join letters
    expect(hits("Rust", "names", "Rusty rusted")).toEqual([])
    expect(hits("RAK", "names", "RAKE RAK4631")).toEqual(["RAK"])
    expect(hits("Vite", "names", "Vitest")).toEqual([])
  })

  it("caseSensitive tokens skip lowercase labels", () => {
    const code = { term: "4A", caseSensitive: true }
    expect(hits(code, "text", "label k7m2-qx6d-4a")).toEqual([])
    expect(hits(code, "text", "category 4A device; 4AB; x4A")).toEqual(["4A"])
  })
})

describe("ids and routes", () => {
  it("maps prerendered files to routes", () => {
    expect(routeFromHtmlPath("index.html")).toBe("/")
    expect(routeFromHtmlPath("terms.html")).toBe("/terms")
    expect(routeFromHtmlPath("demo.html")).toBe("/demo")
    expect(routeFromHtmlPath("docs/index.html")).toBe("/docs")
  })

  it("matches exact ids, globs and *", () => {
    expect(matchesId("/terms", "/terms")).toBe(true)
    expect(matchesId("/terms", "/")).toBe(false)
    expect(matchesId("src/app/terms/**", "src/app/terms/page.tsx")).toBe(true)
    expect(matchesId("src/app/terms/**", "src/app/page.tsx")).toBe(false)
    expect(matchesId("src/app/*.tsx", "src/app/terms/page.tsx")).toBe(false)
    expect(matchesId("*", "/anything")).toBe(true)
  })
})

describe("allowOn", () => {
  const config = {
    text: [{ term: "anonymous", allowOn: ["/terms"] }],
    names: [{ term: "Vercel", allowOn: ["/terms", "src/app/terms/**"] }],
  }

  it("allows a text term only on its routes", () => {
    const result = runCopyCheck({
      config,
      pages: [page("/terms", "<p>anonymous page views</p>"), page("/", "<p>stay anonymous</p>")],
    })
    expect(errors(result).map((f) => f.id)).toEqual(["/"])
  })

  it("allows a name only in its source paths and routes", () => {
    const sources = new Map([
      ["src/app/terms/page.tsx", `export default () => <p>hosted on Vercel; Vercel&apos;s policy</p>`],
      ["src/app/page.tsx", `export const host = "Vercel"`],
    ])
    const result = runCopyCheck({ config, pages: [page("/terms", "Vercel"), page("/", "<i>Vercel</i>")], sources })
    expect(errors(result).map((f) => f.file)).toEqual(["/.html", "src/app/page.tsx:1"])
  })

  it("masks alwaysAllowed words", () => {
    const result = runCopyCheck({ config: { names: ["Git"], alwaysAllowed: ["GitHub"] }, pages: [page("/", "GitHub · Git")] })
    expect(errors(result)).toHaveLength(1)
  })
})

describe("W2 exactly-once rule", () => {
  const run = (homeBody, srcLiterals, extra = {}) =>
    runCopyCheck({
      config: { names: W2, ...extra },
      pages: [page("/", homeBody), page("/terms", extra.termsBody ?? "")],
      sources: new Map(srcLiterals.map((s, i) => [`src/components/s${i}.tsx`, `export const a = ${JSON.stringify(s)}`])),
    })

  it("passes with one line in src and one on the home page", () => {
    expect(errors(run(`<p>${W2_LINE}</p>`, [W2_LINE]))).toEqual([])
  })

  it("fails on zero, unless the legacy pending flag is set", () => {
    expect(errors(run("", [])).map((f) => f.why)).toContain('W2: "Meshtastic" must appear exactly once in the home page HTML; found 0')
    const pending = run("", [], { legacy: { exactlyOncePending: { removeIn: "P3" } } })
    expect(errors(pending)).toEqual([])
    expect(pending.legacy.pendingTerms).toEqual(["Meshtastic", "MeshCore", "Reticulum"])
  })

  it("fails on a second mention in src or on the page, even while pending", () => {
    const legacy = { legacy: { exactlyOncePending: { removeIn: "P3" } } }
    const twiceInSrc = run(`<p>${W2_LINE}</p>`, [W2_LINE, "see Meshtastic"], legacy)
    expect(errors(twiceInSrc).filter((f) => f.term === "Meshtastic")).toHaveLength(2)
    const twiceOnPage = run(`<p>${W2_LINE}</p><p aria-label="Reticulum">x</p>`, [W2_LINE], legacy)
    expect(errors(twiceOnPage).map((f) => f.term)).toEqual(["Reticulum", "Reticulum"])
  })

  it("fails anywhere but the home page", () => {
    const result = run(`<p>${W2_LINE}</p>`, [W2_LINE], { termsBody: "MeshCore" })
    expect(errors(result).map((f) => `${f.term}@${f.id}`)).toEqual(["MeshCore@/terms"])
  })
})

describe("source scanning", () => {
  it("reads string literals, template text and JSX text", () => {
    const code = [
      'const a = "one"',
      "const b = `two ${a} three`",
      "export const C = () => <p title='four'>five &amp; six</p>",
    ].join("\n")
    expect(extractSourceStrings("src/x.tsx", code).map((s) => s.text)).toEqual(["one", "two", "three", "four", "five & six"])
  })

  it("skips import and export specifiers", () => {
    const code = [
      'import React from "React"',
      'export * from "Tailwind"',
      'export { x } from "Next.js"',
      'const lazy = () => import("Deno")',
      'const req = require("Rust")',
      'type T = import("Python").T',
      'export const label = "React"',
    ].join("\n")
    const strings = extractSourceStrings("src/x.ts", code)
    expect(strings).toEqual([{ text: "React", line: 7 }])
    const result = runCopyCheck({ config: { names: ["React", "Tailwind", "Next.js", "Deno", "Rust", "Python"] }, sources: new Map([["src/x.ts", code]]) })
    expect(errors(result).map((f) => `${f.term}:${f.file}`)).toEqual(["React:src/x.ts:7"])
  })

  it("scans every source file with both lists, skipping tests and legacy paths", () => {
    const sources = new Map([
      ["src/lib/a.test.ts", 'it("React", () => {})'],
      ["src/lib/sections-data.ts", 'export const s = "React on a satellite"'],
      ["src/components/demo/copy.ts", 'export const s = "a satellite"'],
      ["src/components/frame/terminal-commands.ts", 'export const devices = ["category 2B", `via ${x} satellite`]'],
    ])
    const result = runCopyCheck({
      config: {
        text: ["satellite", { term: "2B", caseSensitive: true, allowOn: ["src/lib/devices.ts"] }],
        names: ["React"],
        legacy: { skipSource: [{ path: "src/lib/sections-data.ts", removeIn: "P3" }] },
      },
      sources,
    })
    expect(errors(result).map((f) => `${f.match}@${f.file}`)).toEqual([
      "satellite@src/components/demo/copy.ts:1",
      "2B@src/components/frame/terminal-commands.ts:1",
      "satellite@src/components/frame/terminal-commands.ts:1",
    ])
    expect(result.legacy.skipSource[0].used).toBe(1)
  })

  it("allows a text term in the source paths of its allowOn", () => {
    const sources = new Map([
      ["src/lib/devices.ts", 'type C = "2A" | "2B"'],
      ["src/app/terms/page.tsx", "export default () => <p>anonymous page views</p>"],
    ])
    const config = {
      text: [
        { term: "2A", caseSensitive: true, allowOn: ["src/lib/devices.ts"] },
        { term: "2B", caseSensitive: true, allowOn: ["src/lib/devices.ts"] },
        { term: "anonymous", allowOn: ["/terms", "src/app/terms/**"] },
      ],
    }
    expect(errors(runCopyCheck({ config, sources }))).toEqual([])
  })
})

describe("HTML text", () => {
  it("reads prefilled input values and aria-placeholder", () => {
    const text = htmlToText('<input value="hello satellite"/><div aria-placeholder="type here" data-value="hidden"></div>')
    expect(text).toContain("hello satellite")
    expect(text).toContain("type here")
    expect(text).not.toContain("hidden")
  })

  it("keeps text and text attributes, drops scripts and styles, keeps JSON-LD", () => {
    const html = [
      '<head><title>T1</title><meta name="keywords" content="k1,k2"/><style>.satellite{}</style></head>',
      '<body><img alt="a1"/><button aria-label="b1" title="t2" class="cls">x<!-- -->y</button>',
      '<script>self.__next_f.push("rsc satellite")</script>',
      '<script type="application/ld+json">{"description":"ld1"}</script>',
      "<p>Tom&apos;s&nbsp;64&#32;KB</p></body>",
    ].join("")
    const text = htmlToText(html)
    expect(text).toContain("T1")
    expect(text).toContain("k1,k2")
    expect(text).toContain("a1")
    expect(text).toContain("b1")
    expect(text).toContain("t2")
    expect(text).toContain("xy")
    expect(text).toContain("ld1")
    expect(text).toContain("Tom's 64 KB")
    expect(text).not.toContain("satellite")
    expect(text).not.toContain("cls")
  })
})

describe("legacy tolerances", () => {
  const config = {
    text: ["satellite"],
    legacy: { tolerate: [{ phrase: "phones, radios, satellites", route: "/", removeIn: "P1" }] },
  }

  it("tolerates a hit only inside its exact phrase on its route", () => {
    const result = runCopyCheck({
      config,
      pages: [page("/", "Works with phones, radios, satellites. A satellite link."), page("/terms", "phones, radios, satellites")],
    })
    expect(errors(result).map((f) => `${f.match}@${f.id}`)).toEqual(["satellite@/", "satellites@/terms"])
    expect(result.findings.filter((f) => f.level === "legacy")).toHaveLength(1)
    expect(result.legacy.tolerate[0].used).toBe(1)
  })

  it("applies a tolerance whose route is a source path to that file's literals", () => {
    const result = runCopyCheck({
      config: {
        text: ["satellite"],
        legacy: { tolerate: [{ phrase: "satellite messaging", route: "src/app/layout.tsx", removeIn: "P1" }] },
      },
      sources: new Map([
        ["src/app/layout.tsx", 'export const k = ["satellite messaging", "satellite uplink"]'],
        ["src/app/page.tsx", 'export const k = "satellite messaging"'],
      ]),
    })
    expect(errors(result).map((f) => `${f.snippet}@${f.id}`)).toEqual(["satellite uplink@src/app/layout.tsx", "satellite messaging@src/app/page.tsx"])
    expect(result.legacy.tolerate[0].used).toBe(1)
  })

  it("reports stale entries and in-use entries", () => {
    const used = formatReport(runCopyCheck({ config, pages: [page("/", "phones, radios, satellites")] }))
    expect(used).toMatch(/WARNING legacy allowances still in use: 1/)
    expect(used).toMatch(/check-copy: OK/)
    const stale = formatReport(runCopyCheck({ config, pages: [page("/", "nothing here")] }))
    expect(stale).toMatch(/NOTE legacy entries no longer needed/)
  })
})

describe("built text routes", () => {
  it("maps route bodies to routes and keeps only text bodies", () => {
    expect(routeFromBodyPath("llms.txt.body")).toBe("/llms.txt")
    expect(routeFromBodyPath("manifest.webmanifest.body")).toBe("/manifest.webmanifest")
    expect(isTextBody("/manifest.webmanifest", { headers: { "content-type": "application/manifest+json" } })).toBe(true)
    expect(isTextBody("/robots.txt", { headers: { "content-type": "text/plain" } })).toBe(true)
    expect(isTextBody("/sitemap.xml", { headers: { "content-type": "application/xml" } })).toBe(true)
    expect(isTextBody("/favicon.ico", { headers: { "content-type": "image/x-icon" } })).toBe(false)
    expect(isTextBody("/llms.txt", undefined)).toBe(true)
    expect(isTextBody("/opengraph-image.png", undefined)).toBe(false)
  })
})

describe("requiredFiles and mustContain", () => {
  const config = {
    requiredFiles: ["/", "/llms.txt"],
    mustContain: [{ id: "/llms.txt", text: "{SITE_VERSION}" }],
  }
  const constants = { SITE_VERSION: "V.0.0.6 Experimental" }
  const llms = (text) => ({ id: "/llms.txt", file: "public/llms.txt", text })

  it("fails when a required file is missing from the build", () => {
    const result = runCopyCheck({ config, constants, pages: [page("/", "")] })
    expect(errors(result).map((f) => `${f.list}:${f.id}`)).toEqual(["required:/llms.txt", "mustContain:/llms.txt"])
  })

  it("checks required text, filled from site constants", () => {
    expect(errors(runCopyCheck({ config, constants, pages: [page("/", "")], textFiles: [llms("Release: V.0.0.6 Experimental.")] }))).toEqual([])
    expect(errors(runCopyCheck({ config, constants, pages: [page("/", "")], textFiles: [llms("Release: v0.0.5")] }))).toHaveLength(1)
  })

  it("downgrades a missing text to a legacy warning while pending, and reports it stale once satisfied", () => {
    const pendingConfig = { ...config, legacy: { mustContainPending: [{ id: "/llms.txt", removeIn: "P1" }] } }
    const missing = runCopyCheck({ config: pendingConfig, constants, pages: [page("/", "")], textFiles: [llms("v0.0.5")] })
    expect(errors(missing)).toEqual([])
    expect(formatReport(missing)).toMatch(/mustContain pending on \/llms\.txt/)
    const satisfied = runCopyCheck({ config: pendingConfig, constants, pages: [page("/", "")], textFiles: [llms("V.0.0.6 Experimental")] })
    expect(formatReport(satisfied)).toMatch(/NOTE legacy entries no longer needed[\s\S]*mustContain pending/)
  })

  it("skips both rules without built output (--src-only)", () => {
    expect(errors(runCopyCheck({ config, constants }))).toEqual([])
  })

  it("refuses an unknown placeholder", () => {
    expect(fillPlaceholders("{SITE_VERSION}!", constants)).toBe("V.0.0.6 Experimental!")
    expect(() => fillPlaceholders("{NOPE}", constants)).toThrow(/NOPE/)
  })
})

describe("/demo import denylist", () => {
  const demo = { dirs: ["src/components/demo", "src/app/demo"], deny: ["framer-motion", "lucide-react"] }

  it("collects runtime imports and skips type-only ones", () => {
    const code = [
      'import { motion } from "framer-motion"',
      'import type { LucideIcon } from "lucide-react"',
      'import { type Foo } from "lucide-react/x"',
      'export { a } from "./a"',
      'const m = import("framer-motion/dom")',
    ].join("\n")
    expect(extractImports("src/components/demo/x.tsx", code).map((i) => i.spec)).toEqual(["framer-motion", "./a", "framer-motion/dom"])
  })

  it("flags direct and transitive imports of denied packages", () => {
    const files = new Map([
      ["src/app/demo/page.tsx", 'import { Shell } from "@/components/demo/shell"\nexport default Shell'],
      ["src/components/demo/shell.tsx", 'import { Chip } from "../common/chip"\nimport { X } from "lucide-react"\nexport const Shell = 1'],
      ["src/components/common/chip.tsx", 'import { motion } from "framer-motion"\nexport const Chip = 1'],
      ["src/components/frame/hero.tsx", 'import { motion } from "framer-motion"'],
    ])
    const findings = checkDemoImports(files, demo)
    expect(findings.map((f) => `${f.term}@${f.file}`).sort()).toEqual([
      "framer-motion@src/components/common/chip.tsx:1",
      "lucide-react@src/components/demo/shell.tsx:2",
    ])
    expect(findings.find((f) => f.term === "framer-motion").snippet).toContain("src/app/demo/page.tsx → src/components/demo/shell.tsx → src/components/common/chip.tsx")
  })

  it("passes when the demo directories do not exist", () => {
    expect(checkDemoImports(new Map([["src/app/page.tsx", 'import "framer-motion"']]), demo)).toEqual([])
  })
})

describe("copy-denylist.json", () => {
  const config = JSON.parse(fs.readFileSync(DEFAULT_CONFIG, "utf8"))

  it("compiles every entry and gives every legacy entry a removeIn phase", () => {
    for (const e of config.text) expect(() => compileEntry(e, "text")).not.toThrow()
    for (const e of config.names) expect(() => compileEntry(e, "names")).not.toThrow()
    const legacy = [
      ...config.legacy.skipSource,
      ...config.legacy.tolerate,
      config.legacy.exactlyOncePending,
      ...(config.legacy.mustContainPending ?? []),
    ].filter(Boolean)
    for (const entry of legacy) expect(entry.removeIn).toMatch(/^P\d$/)
  })

  it("catches the reviewers' leak samples", () => {
    const compiled = [...config.text.map((e) => compileEntry(e, "text")), ...config.names.map((e) => compileEntry(e, "names"))]
    const leaks = (s) => compiled.flatMap((e) => findMatches(e, s).map((m) => m.match))
    for (const sample of [
      "Qwen3-4B",
      "Llama3",
      "GPT4o",
      "LoRa32",
      "MeshtasticPKI",
      "LORA RADIO",
      "a Light Terminal",
      "two Knowledge Hubs",
      "Local Hubs",
      "1B–3B parameters",
      "8B–70B",
      "BIP-39 words",
      "SLIP-0010",
      "EDHOC",
      "Noise Protocol",
      "Bundle Protocol",
      "Bramble",
      "Sub-GHz",
      "Kiwix",
      "Wikipedia",
      "OpenStreetMap",
      "intermittent gateways",
    ]) {
      expect(leaks(sample), sample).not.toEqual([])
    }
    // generic role nouns stay allowed (W5)
    expect(leaks("a local hub nearby, a relay, a bridge, a gateway, a hub")).toEqual([])
  })

  it("keeps the W2 names exactly-once and never denies GitHub or the generic medium words", () => {
    const w2 = config.names.filter((e) => typeof e === "object" && e.exactlyOnce).map((e) => e.term)
    expect(w2).toEqual(["Meshtastic", "MeshCore", "Reticulum"])
    const result = runCopyCheck({
      config,
      built: false,
      pages: [page("/", "GitHub · GITHUB · Wi-Fi · Bluetooth · USB-C · long-range radio · ethernet · a local model · keypair")],
    })
    expect(errors(result)).toEqual([])
  })
})
