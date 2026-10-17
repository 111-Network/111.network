import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Hero } from "@/components/frame/hero"
import { Navigation } from "@/components/frame/navigation"
import { LAYERS } from "@/lib/layers"
import { ANCHORS, DEMO_PATH, DEMO_READY, GITHUB_URL, INSTALL_COMMANDS, SITE_VERSION } from "@/lib/site"

// Server render of the header (what the prerendered HTML holds), checked
// against plan §4.1 and the P1 brief.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1

describe("Navigation server render", () => {
  const html = renderToString(createElement(Navigation))

  it("is a sticky, blurred header with a skip link to #main", () => {
    expect(html).toMatch(/<header[^>]*class="[^"]*sticky[^"]*backdrop-blur-md/)
    expect(html).toMatch(new RegExp(`<a[^>]*href="#${ANCHORS.main}"[^>]*>Skip to content</a>`))
  })

  it("has the logo as a link back to the top", () => {
    expect(html).toMatch(/<a[^>]*aria-label="111\.network, back to top"[^>]*href="\/"|<a[^>]*href="\/"[^>]*aria-label="111\.network, back to top"/)
  })

  it("has a rail of ten real #layer-N anchors, in order, each named by its layer", () => {
    const hrefs = [...html.matchAll(/href="#(layer-\d)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(LAYERS.map((layer) => layer.id))
    for (const layer of LAYERS) {
      expect(html).toMatch(new RegExp(`aria-label="Layer ${layer.n}: ${esc(layer.title)}"[^>]*href="#${layer.id}"`))
    }
  })

  it("marks no layer as current before the scroll-spy runs", () => {
    expect(html).not.toContain("aria-current")
  })

  it("prints the idle readouts", () => {
    expect(html).toContain("LAYERS 0–9")
    expect(html).toContain("L–/9")
  })

  it("links TERMINAL to #terminal, and DEMO only once the demo is ready", () => {
    expect(html).toMatch(new RegExp(`<a[^>]*href="#${ANCHORS.terminal}"[^>]*>TERMINAL</a>`))
    expect(html.includes(`href="${DEMO_PATH}"`)).toBe(DEMO_READY)
  })

  it("links the GitHub icon to the org, with an accessible name", () => {
    expect(html).toMatch(new RegExp(`<a[^>]*href="${esc(GITHUB_URL)}"[^>]*aria-label="111 Network on GitHub"`))
  })

  it("links mobile INSTALL to #install and never carries the #install id itself", () => {
    expect(html).toMatch(new RegExp(`<a[^>]*href="#${ANCHORS.install}"[^>]*>INSTALL</a>`))
    expect(html).not.toContain(`id="${ANCHORS.install}"`)
  })

  it("server-renders the INSTALL and MENU triggers as closed placeholder buttons", () => {
    expect(html).toMatch(/<button type="button" aria-haspopup="dialog" aria-expanded="false" data-state="closed"[^>]*>INSTALL<\/button>/)
    expect(html).toMatch(/<button type="button" aria-haspopup="dialog" aria-expanded="false" data-state="closed"[^>]*>MENU<\/button>/)
  })

  it("keeps the overlays' content out of the HTML (they load after hydration)", () => {
    expect(html).not.toContain(esc(INSTALL_COMMANDS.host))
    expect(html).not.toContain(esc(SITE_VERSION))
    expect(html).not.toContain("Layers and pages")
  })

  it("draws the ten-segment depth strip, empty", () => {
    expect(count(html, "data-fill=")).toBe(10)
  })
})

describe("Navigation + Hero", () => {
  it("the page has exactly one #install", () => {
    const html = renderToString(createElement(Navigation)) + renderToString(createElement(Hero))
    expect(count(html, `id="${ANCHORS.install}"`)).toBe(1)
  })
})
