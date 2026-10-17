// Server-render smoke tests of the Bridge page, one per phase: it renders in node, its headings follow
// the shell, the [DEMO] plug button sits on the page before the radio, the board's steps run here, and
// once ready it shows the preferred networks (first hit wins) and the diagram with the buffer sentence.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BRIDGE_COPY } from "../../../copy/bridge"
import { BRIDGE_REASON, DEMO_ACTIONS, DEMO_NOTE } from "../../../copy/core"
import { DemoStoreProvider } from "../../../engine/react"
import { PATHS, parsePath } from "../../../engine/router"
import { createDemoStore, type DemoStore } from "../../../engine/store"
import { DEMO_WORLD } from "../../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../../shell/context"
import BridgePage from "./index"

const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>

const shell = (embedded: boolean): ShellContextValue => ({
  mainId: "m",
  mainRef: { current: null },
  announce: () => {},
  embedded,
  headingBase: embedded ? 3 : 1,
})

function render(store: DemoStore, embedded = false): string {
  const live: DemoStore = { ...store, getServerSnapshot: store.getSnapshot }
  const route = parsePath(PATHS.service("bridge"))
  return renderToString(
    createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, createElement(BridgePage, { route, id: "bridge" }))),
  )
}

const newStore = () => {
  const store = createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/services/bridge" })
  store.start()
  return store
}

const text = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")

function radioUp(store: DemoStore): void {
  store.dispatch({ type: "core/radioPlugged" })
  store.dispatch({ type: "core/radioAllowed", instant: true })
  store.dispatch({ type: "core/radioFlash", instant: true })
  store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
}

describe("Bridge page render", () => {
  it("opens NOT SET 'Needs a radio.' with [DEMO] plug in a radio board on the page and no networks or diagram yet", () => {
    const html = render(newStore())
    expect(html).toMatch(/<h1[^>]*>Bridge<\/h1>/)
    const t = text(html)
    expect(t).toContain("Needs a radio.")
    expect(t).toMatch(new RegExp(`DEMO\\W* ${DEMO_ACTIONS.plugRadio}`))
    expect(t).toContain(BRIDGE_COPY.radio.none)
    expect(t).toContain(BRIDGE_COPY.facts.heading)
    expect(t).not.toContain(BRIDGE_COPY.networks.heading)
    expect(t).not.toContain(BRIDGE_COPY.diagram.heading)
    expect(html).toMatch(/<h2[^>]*>Set up the radio board<\/h2>/)
  })

  it("takes the L4 window's heading levels", () => {
    const html = render(newStore(), true)
    expect(html).toMatch(/<h3[^>]*>Bridge<\/h3>/)
    expect(html).toMatch(/<h4[^>]*>Set up the radio board<\/h4>/)
  })

  it("runs the board's steps here: allow once, then (after identify) the flash offer, then the region", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    let t = text(render(store))
    expect(t).toContain(BRIDGE_COPY.radio.titles.plugged)
    expect(t).toContain(BRIDGE_COPY.radio.allow)
    expect(t).not.toContain(DEMO_ACTIONS.plugRadio)

    store.dispatch({ type: "core/radioAllowed", instant: true })
    t = text(render(store))
    expect(t).toContain(BRIDGE_COPY.radio.titles.identified)
    expect(t).toContain(BRIDGE_COPY.radio.erases)
    expect(t).toContain(BRIDGE_COPY.radio.flashOpen)

    store.dispatch({ type: "core/radioFlash", instant: true })
    t = text(render(store))
    expect(t).toContain(BRIDGE_COPY.radio.titles.flashed)
    for (const r of DEMO_WORLD.regions) expect(t).toContain(r)
  })

  it("once ready: the role toggle, the preferred networks tried in order, the diagram and the verbatim buffer sentence", () => {
    const store = newStore()
    radioUp(store)
    const html = render(store)
    const t = text(html)
    expect(t).toContain(BRIDGE_REASON.ready)
    expect(t).toContain(BRIDGE_COPY.role.label)
    expect(html).toContain('aria-pressed="false"')
    expect(t).toContain(BRIDGE_COPY.networks.heading)
    expect(t).toContain(BRIDGE_COPY.networks.priorityValue)
    expect(t).toContain("JOINED Network A")
    expect(t).toMatch(/Network A long-range radio FOUND/)
    expect(t).toContain(BRIDGE_COPY.networks.heartbeats("Network A", "09:00"))
    expect(t).toContain(BRIDGE_COPY.diagram.heading)
    expect(t).toContain(BRIDGE_REASON.buffer)
    expect(t).toContain(BRIDGE_COPY.diagram.needsOn)
    expect(t).not.toContain(BRIDGE_COPY.diagram.cross)
  })

  it("with the bridge on, a sample message crossing carries its demo note and an unchanged payload", () => {
    const store = newStore()
    radioUp(store)
    store.dispatch({ type: "bridge/setRole", on: true, instant: true })
    let t = text(render(store))
    expect(t).toMatch(new RegExp(`DEMO\\W* ${BRIDGE_COPY.diagram.cross}`))
    expect(t).not.toContain(DEMO_NOTE.message)

    store.dispatch({ type: "bridge/cross" })
    t = text(render(store))
    expect(t).toContain("outer wrapper: long-range radio")
    expect(t).toContain(DEMO_NOTE.message)
    expect(t).toContain(BRIDGE_COPY.diagram.unchanged)
    store.scheduler.advance(1100)
    t = text(render(store))
    expect(t).toContain("outer wrapper: long-range radio → Wi-Fi")
  })

  it("a stopped radio: the page says why the bridge waits and links to the radio's page", () => {
    const store = newStore()
    radioUp(store)
    store.dispatch({ type: "bridge/setRole", on: true, instant: true })
    store.dispatch({ type: "core/serviceTransition", id: "radio", to: "error" })
    const t = text(render(store))
    expect(t).toContain(BRIDGE_COPY.pausedReason)
    expect(t).toContain(BRIDGE_COPY.down.heading)
    expect(t).toContain(BRIDGE_COPY.role.pausedNote)
    expect(t).toContain(BRIDGE_COPY.facts.radioLink)
  })
})
