import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { getLayer } from "@/lib/layers"
import { Layer5 } from "./index"
import { CARGO_KINDS, HUB_SEES, PASSER_SEES, STATIONS } from "./model"

// The static copy must be in the server HTML (the copy check reads it, and it
// reads without JavaScript): the receipt's first state, the station notes and
// disclosure lines, the four specs and the cargo row.
describe("Layer5 server render", () => {
  const html = renderToString(createElement(Layer5))
    .replace(/<!-- -->/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")

  it("renders the section with its id and title", () => {
    expect(html).toContain('id="layer-5"')
    expect(html).toContain("Messaging & Data")
  })

  it("prints every station and what the middle ones can see", () => {
    for (const s of STATIONS) expect(html).toContain(`${s.name} <`)
    for (const s of STATIONS) expect(html).toContain(`(${s.note})`)
    expect(html).toContain(HUB_SEES)
    expect(html).toContain(PASSER_SEES)
  })

  it("starts idle: nothing sent, every link off, expiry none", () => {
    expect(html).toContain("Press SEND. Turn links on or off at any time.")
    expect(html).toContain("nothing sent yet")
    expect(html).toContain("expiry: none")
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3)
    expect(html).toContain("SIMULATION")
  })

  it("keeps SEND and WAIT A YEAR focusable (aria-disabled, never disabled) with the reason wired", () => {
    expect(html).not.toMatch(/<button[^>]*\sdisabled=/)
    const wait = html.match(/<button[^>]*>WAIT A YEAR<\/button>/)?.[0] ?? ""
    expect(wait).toContain('aria-disabled="true"')
    const describedBy = wait.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(describedBy).toBeDefined()
    expect(html).toContain(`id="${describedBy}" class="min-w-0 font-mono text-[10px] text-muted-foreground">Press SEND first.`)
    const send = html.match(/<button[^>]*>SEND<\/button>/)?.[0] ?? ""
    expect(send).not.toContain("aria-disabled")
  })

  it("names each disclosure button after its station", () => {
    for (const s of STATIONS.filter((st) => st.sees)) {
      expect(html).toContain(`<span class="sr-only">${s.name}: </span>what it sees`)
    }
  })

  it("keeps only dt and dd inside each group of the terms list", () => {
    const dl = html.match(/<dl[^>]*>([\s\S]*?)<\/dl>/)?.[1] ?? ""
    expect(dl).not.toBe("")
    const groups = dl.match(/<div[^>]*>([\s\S]*?)<\/div>/g) ?? []
    expect(groups).toHaveLength(4)
    for (const g of groups) {
      const inner = g.replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "")
      expect(inner).toMatch(/^<dt[^>]*>[^<]*<\/dt><dd[^>]*>[^<]*<\/dd>$/)
    }
  })

  it("prints the four specs and the five kinds of cargo", () => {
    for (const spec of getLayer(5).specs) {
      expect(html).toContain(spec.label)
      expect(html).toContain(spec.value)
    }
    for (const kind of CARGO_KINDS) expect(html).toContain(kind)
  })
})
