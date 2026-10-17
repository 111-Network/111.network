import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Layer0 } from "./index"

// Server-render smoke test of the whole section (no DOM needed): the first
// paint carries the static copy and has no motion (W14: nothing animates on
// page load; the deal / fade classes appear only after a click).

const html = renderToStaticMarkup(createElement(Layer0))

describe("Layer0 first paint", () => {
  it("renders the section shell with its title id", () => {
    expect(html).toContain('id="layer-0"')
    expect(html).toContain('id="layer-0-title"')
  })

  it("prints the six drawer fronts as one tablist, the open drawer selected", () => {
    for (const label of ["PROJECTS", "DEVICES", "RECIPES", "PROTOCOLS", "LOCAL MODELS", "CONCEPTS"]) {
      expect(html).toContain(`>${label}</span>`)
    }
    expect(html.match(/role="tablist"/g)).toHaveLength(1)
    expect(html.match(/role="tab"/g)).toHaveLength(6)
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    // Roving tabindex: only the open drawer is in the tab order.
    expect(html.match(/role="tab"[^>]*tabindex="0"/g)).toHaveLength(1)
    expect(html.match(/role="tab"[^>]*tabindex="-1"/g)).toHaveLength(5)
  })

  it("labels the tray as the open drawer's tabpanel", () => {
    expect(html.match(/role="tabpanel"/g)).toHaveLength(1)
    expect(html).toMatch(/id="layer-0-drawer-projects"[^>]*aria-selected="true"/)
    expect(html).toMatch(/role="tabpanel" aria-labelledby="layer-0-drawer-projects"/)
  })

  it("marks the open card as current, never as a toggle or a disclosure", () => {
    expect(html).not.toContain("aria-pressed")
    expect(html).not.toContain("aria-expanded")
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
  })

  it("names the search slot starting with its visible words", () => {
    expect(html).toContain('aria-label="Search slot &quot;radio&quot;: print a call slip"')
    expect(html).toContain(">Search slot</span>")
  })

  it("opens the proven example note as a record", () => {
    for (const label of ["What it is", "Use when", "Do NOT use when", "Evidence"]) expect(html).toContain(`>${label}</dt>`)
    expect(html).toContain("Long-range mesh firmware")
    expect(html).toContain(">example</span>")
  })

  it("server-renders the legend, the specs and the simulation chip", () => {
    expect(html).toContain("Reputation alone never earns it.")
    expect(html).not.toContain("Reputation alone stops here.")
    expect(html).toContain("Concepts carry no grade.")
    for (const value of ["Small notes, one topic each", "Candidate, Testing, Proven", "Agent first, human second", "Adopt before build"]) {
      expect(html).toContain(value)
    }
    expect(html).toContain(">SIMULATION</span>")
  })

  it("has no motion and no call slip until a click", () => {
    expect(html).not.toContain("animate-in")
    expect(html).not.toContain("animation-delay")
    expect(html).not.toContain("READ INDEX")
  })

  it("has one polite live line", () => {
    expect(html.match(/role="status"/g)).toHaveLength(1)
  })
})
