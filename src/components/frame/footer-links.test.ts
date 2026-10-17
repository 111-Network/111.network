import { describe, expect, it } from "vitest"
import { DEMO_PATH } from "@/lib/site"
import { exploreLinks, type ExploreLink } from "./footer-links"

/** Each entry as "Label -> #anchor" or "Label -> /route", so order and targets are checked together. */
function targets(links: readonly ExploreLink[]): string[] {
  return links.map((link) => `${link.label} -> ${"anchor" in link ? `#${link.anchor}` : link.href}`)
}

describe("footer Explore links (plan §4.5)", () => {
  it("are Layers · Terminal · Install with no Demo link while the demo is not ready (§4.2)", () => {
    expect(targets(exploreLinks(false))).toEqual(["Layers -> #layer-0", "Terminal -> #terminal", "Install -> #install"])
  })

  it("add Demo as the second entry, a route to /demo, once the demo is ready", () => {
    expect(DEMO_PATH).toBe("/demo")
    expect(targets(exploreLinks(true))).toEqual([
      "Layers -> #layer-0",
      "Demo -> /demo",
      "Terminal -> #terminal",
      "Install -> #install",
    ])
  })

  it("never point an in-page anchor at a route, or a route at an anchor", () => {
    for (const link of exploreLinks(true)) {
      if ("anchor" in link) expect(link.anchor).not.toMatch(/^[#/]/)
      else expect(link.href.startsWith("/")).toBe(true)
    }
  })

  it("have unique labels (they double as React keys)", () => {
    const labels = exploreLinks(true).map((link) => link.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
