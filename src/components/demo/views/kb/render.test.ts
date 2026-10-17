// Server-render smoke tests of the Knowledge base view: index, drawer and note pages, both readers,
// the find field and call slip, the 404s, the shell's heading levels, and real in-demo links only.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DemoStoreProvider } from "../../engine/react"
import { parsePath, PATHS } from "../../engine/router"
import { createDemoStore, type DemoStore } from "../../engine/store"
import { DEMO_WORLD } from "../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../shell/context"
import KbView from "./index"

const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>

const shell = (embedded: boolean): ShellContextValue => ({
  mainId: "m",
  mainRef: { current: null },
  announce: () => {},
  embedded,
  headingBase: embedded ? 3 : 1,
})

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })

/** Render one route against the CURRENT state (on the server useDemo reads getServerSnapshot). */
function render(path: string, store: DemoStore = newStore(), embedded = false): string {
  const live: DemoStore = { ...store, getServerSnapshot: store.getSnapshot }
  const view = createElement(KbView, { route: parsePath(path) })
  return renderToString(createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, view)))
}

/** Visible text without tags (and React's comment markers), whitespace collapsed. */
const text = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")

describe("Knowledge base view render", () => {
  it("index: title, the six drawer fronts, the human index by drawer and the grade legend", () => {
    const html = render(PATHS.kb)
    expect(html).toMatch(/<h1[^>]*>Knowledge base<\/h1>/)
    const t = text(html)
    for (const label of ["PROJECTS", "DEVICES", "RECIPES", "PROTOCOLS", "LOCAL MODELS", "CONCEPTS"]) expect(t).toContain(label)
    expect(t).toContain("Long-range mesh firmware")
    expect(t).toContain("Desk research only. Alternatives compared.")
    expect(t).toContain("HUMAN")
    expect(t).toContain("Find a note")
    expect(html).toContain('href="/demo#/kb/local-models"')
    expect(html).toContain('href="/demo#/kb/concepts/thin-bridge"')
    expect(html).not.toMatch(/href="#(?!\/)/)
    expect(t).not.toMatch(/\d+ proven/)
  })

  it("drawer: the open front is the current page, its cards link to their notes", () => {
    const html = render(PATHS.kbDrawer("concepts"))
    expect(html).toMatch(/<h1[^>]*>Concepts<\/h1>/)
    expect(html).toMatch(/aria-current="page"[^>]*href="\/demo#\/kb\/concepts"|href="\/demo#\/kb\/concepts"[^>]*aria-current="page"/)
    const t = text(html)
    expect(t).toContain("All drawers")
    expect(t).toContain("Thin bridge")
    expect(t).toContain("concepts/sandbox-first")
    expect(t).not.toContain("Long-range mesh firmware")
  })

  it("note (human): record table, the four sections in order, evidence, links and the services using it", () => {
    const t = text(render(PATHS.kbNote("recipes", "set-up-a-radio-board")))
    expect(t).toContain("Set up a radio board")
    const order = ["What it is", "Use when", "Do NOT use when", "Details", "Evidence", "Linked notes", "Used by"].map((s) => t.indexOf(s))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(t).toContain("alternatives compared")
    expect(t).toContain("bench test")
    expect(t).toContain("· not yet")
    expect(t).toContain("Long-range radio")
    // The path row is advanced-only.
    expect(t).not.toContain("recipes/set-up-a-radio-board")
  })

  it("a concept carries no grade and no evidence checks; advanced mode adds the path row", () => {
    const store = newStore()
    store.dispatch({ type: "core/setMode", mode: "advanced" })
    const t = text(render(PATHS.kbNote("concepts", "thin-bridge"), store))
    expect(t).toContain("concept, no grade")
    expect(t).toContain("No grade. A concept is a timeless reference, not a project to adopt.")
    expect(t).not.toContain("bench test")
    expect(t).toContain("concepts/thin-bridge")
    expect(t.toLowerCase()).toContain("nothing is discarded by policy; a full buffer refuses new frames until space frees, and the sender retries")
  })

  it("agent reader: one index line per note, the current one marked", () => {
    const store = newStore()
    store.dispatch({ type: "kb/setReader", reader: "agent" })
    const html = render(PATHS.kbNote("devices", "radio-box"), store)
    const t = text(html)
    expect(t).toContain("# Knowledge base")
    expect(t).toContain("- [Small box with a radio](devices/radio-box):")
    expect(t).toContain("- [Old phone](devices/old-phone):")
    expect(t).not.toContain("What it is")
    expect(html).toMatch(/aria-current="page"[^>]*href="\/demo#\/kb\/devices\/radio-box"|href="\/demo#\/kb\/devices\/radio-box"[^>]*aria-current="page"/)
  })

  it("find: the fronts count matches, the agent prints the call slip whole", () => {
    const store = newStore()
    store.dispatch({ type: "kb/setQuery", query: "radio" })
    const human = text(render(PATHS.kb, store))
    expect(human).toContain("notes match.")
    expect(human).toContain("no match")
    expect(human).not.toContain("Adopt before build")
    store.dispatch({ type: "kb/setReader", reader: "agent" })
    const agent = text(render(PATHS.kb, store))
    expect(agent).toContain('READ INDEX → SEARCH "radio" → OPEN ONE → STOP')
    expect(agent).toContain("opens: devices/radio-box · nothing else read")
    store.dispatch({ type: "kb/setQuery", query: "zzzz" })
    expect(text(render(PATHS.kb, store))).toContain("no note matched: nothing opened")
    expect(text(render(PATHS.kbDrawer("concepts"), store))).toContain('No note in the Concepts drawer matches "zzzz".')
  })

  it("not found: honest empty states with the way back", () => {
    expect(text(render("/kb/attic"))).toContain("No such drawer")
    const note = render("/kb/concepts/nope")
    expect(text(note)).toContain('The Concepts drawer has no note called "nope".')
    expect(note).toContain('href="/demo#/kb/concepts"')
    const elsewhere = render("/kb/projects/thin-bridge")
    expect(text(elsewhere)).toContain("That note is in another drawer")
    expect(elsewhere).toContain('href="/demo#/kb/concepts/thin-bridge"')
  })

  it("takes the shell's heading levels inside the L4 window", () => {
    const html = render(PATHS.kb, newStore(), true)
    expect(html).toMatch(/<h3[^>]*>Knowledge base<\/h3>/)
    expect(html).toMatch(/<h4[^>]*>/)
    expect(html).not.toMatch(/<h[12][\s>]/)
  })

  it("shows the degraded note only while the Knowledge base service is not LIVE", () => {
    expect(text(render(PATHS.kb))).not.toContain("The notes below are the copy this node already holds.")
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "kb", to: "error", reason: "The knowledge base failed its check." })
    const t = text(render(PATHS.kb, store))
    expect(t).toContain("The notes below are the copy this node already holds.")
    expect(t).toContain("ERROR")
  })
})
