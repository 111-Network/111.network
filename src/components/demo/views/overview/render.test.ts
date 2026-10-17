// Server-render smoke tests of the Overview view: it renders in node (no window), its headings
// follow the shell (h1 on /demo, h3 in the L4 window), and what it prints follows the store.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DemoStoreProvider } from "../../engine/react"
import { createDemoStore, type DemoStore } from "../../engine/store"
import { DEMO_WORLD } from "../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../shell/context"
import OverviewView from "./index"

const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>

const shell = (embedded: boolean): ShellContextValue => ({
  mainId: "m",
  mainRef: { current: null },
  announce: () => {},
  embedded,
  headingBase: embedded ? 3 : 1,
})

/** Render the CURRENT state: on the server useDemo reads getServerSnapshot, so point it at the live one. */
function render(store: DemoStore, embedded = false): string {
  const live: DemoStore = { ...store, getServerSnapshot: store.getSnapshot }
  return renderToString(createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, createElement(OverviewView))))
}

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })

/** Visible text without tags (and React's comment markers), whitespace collapsed. */
const text = (html: string) => html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

describe("Overview view render", () => {
  it("opens with the node's name, the verdict, the radio NOT SET row and the services grid", () => {
    const html = render(newStore())
    expect(html).toMatch(/<h1[^>]*>Workshop laptop<\/h1>/)
    const t = text(html)
    expect(t).toContain("Your node is running. It is alone on the mesh right now: no nearby nodes heard.")
    expect(html).toContain('id="needs-you"')
    expect(t).toContain("Long-range radio NOT SET")
    expect(t).toContain("Set up with the agent")
    expect(t).toContain("Identity backup")
    // The one sample message request waits in "needs you", marked as a demo item.
    expect(t).toContain("1 message request")
    expect(t).toContain("demo message")
    for (const name of ["Local AI agent", "Local model", "Mesh link", "Knowledge base", "Internet gateway", "Messaging", "Bridge", "Storage", "Repairs"]) {
      expect(t).toContain(name)
    }
    expect(t).toContain("Nothing attached or paired yet.")
    expect(t).toContain("Let the agent check this node")
    // Every link inside the view is a real in-demo href.
    expect(html).toContain('href="/demo#/services/radio"')
    expect(html).not.toMatch(/href="#(?!\/)/)
  })

  it("takes the shell's heading levels inside the L4 window", () => {
    const html = render(newStore(), true)
    expect(html).toMatch(/<h3[^>]*>Workshop laptop<\/h3>/)
    expect(html).toMatch(/<h4[^>]*>Needs you<\/h4>/)
    expect(html).not.toMatch(/<h[12][\s>]/)
  })

  it("follows the store: radio set up -> connected, nearby nodes with their demo note, the bridge row", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    const t = text(render(store))
    expect(t).toContain("Your node is running and connected to nearby nodes: messages can flow.")
    expect(t).toContain("Ridge repeater")
    expect(t).toContain("forwards sealed traffic; cannot read it")
    expect(t).toContain("demo node")
    expect(t).toContain("Bridge NOT SET")
    expect(t).not.toContain("Long-range radio NOT SET")
    expect(t).toContain("also bridges radio and Wi-Fi")
    expect(t).toContain("First-run checklist · 3 of 4 done · 1 unknown")
  })

  it("advanced mode adds the whole events log", () => {
    const store = newStore()
    store.dispatch({ type: "core/setMode", mode: "advanced" })
    store.dispatch({ type: "core/radioPlugged" })
    const t = text(render(store))
    expect(t).toContain("all events")
    expect(t).toContain("A radio board was plugged in.")
  })
})
