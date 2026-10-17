import { afterEach, describe, expect, it, vi } from "vitest"
import { scrollToAnchor, scrollToLayer } from "@/lib/scroll"

// Node env: a stub document/window records what the helper does.

function stubPage({ reduced = false }: { reduced?: boolean } = {}) {
  const calls: string[] = []
  const attrs = new Map<string, string>()
  const section = {
    scrollIntoView: (o: ScrollIntoViewOptions) => calls.push(`scroll:${o.behavior}`),
    hasAttribute: (n: string) => attrs.has(n),
    setAttribute: (n: string, v: string) => attrs.set(n, v),
    matches: () => false,
    focus: (o: FocusOptions) => calls.push(`focus:${o.preventScroll}`),
  }
  vi.stubGlobal("document", { getElementById: (id: string) => (id === "layer-3" || id === "install" ? section : null) })
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: reduced }),
    history: { replaceState: (_s: unknown, _t: string, url: string) => calls.push(`hash:${url}`) },
  })
  return { calls, attrs }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("scrollToAnchor / scrollToLayer", () => {
  it("scrolls smoothly, writes the hash with replaceState and moves focus", () => {
    const { calls, attrs } = stubPage()
    expect(scrollToLayer(3)).toBe(true)
    expect(calls).toEqual(["scroll:smooth", "hash:#layer-3", "focus:true"])
    expect(attrs.get("tabindex")).toBe("-1")
  })

  it("jumps under reduced motion and accepts a leading #", () => {
    const { calls } = stubPage({ reduced: true })
    expect(scrollToAnchor("#install", { focus: false })).toBe(true)
    expect(calls).toEqual(["scroll:auto", "hash:#install"])
  })

  it("returns false for a missing target or a bad layer number", () => {
    const { calls } = stubPage()
    expect(scrollToAnchor("nope")).toBe(false)
    expect(scrollToLayer(12)).toBe(false)
    expect(scrollToLayer(7)).toBe(false)
    expect(calls).toEqual([])
  })
})
