// Server-render smoke tests of the Devices views: they render in node (no window), headings follow
// the shell, every demo trigger is a [DEMO] button inside the view, and what is printed follows the
// store through the whole radio board flow. Copy rules: no numbers that read as hardware data.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DEVICE_COPY } from "../../copy/core"
import { DEVICES_COPY } from "../../copy/devices"
import { TIMING } from "../../engine/core"
import { DemoStoreProvider } from "../../engine/react"
import { parsePath } from "../../engine/router"
import { createDemoStore, type DemoStore } from "../../engine/store"
import { DEMO_WORLD } from "../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../shell/context"
import DevicesView from "./index"

const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>

const shell = (embedded: boolean): ShellContextValue => ({
  mainId: "m",
  mainRef: { current: null },
  announce: () => {},
  embedded,
  headingBase: embedded ? 3 : 1,
})

function render(store: DemoStore, path: string, embedded = false): string {
  const live: DemoStore = { ...store, getServerSnapshot: store.getSnapshot }
  const view = createElement(DevicesView, { route: parsePath(path) })
  return renderToString(createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, view)))
}

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/devices" })
const text = (html: string) => html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ")
const BOARD = "/devices/radio-board"

describe("Devices list", () => {
  it("opens with this laptop in plain words, the honest empty state and the [DEMO] plug-in button", () => {
    const html = render(newStore(), "/devices")
    expect(html).toMatch(/<h1[^>]*>Devices<\/h1>/)
    const t = text(html)
    expect(t).toContain("Workshop laptop")
    expect(t).toContain("LAPTOP")
    expect(t).toContain("Wi-Fi that can host a hotspot")
    expect(t).toContain("no radio board yet")
    expect(t).toContain(DEVICES_COPY.own.notYetNoRadio)
    expect(t).not.toContain(DEVICE_COPY.ownBridges)
    expect(t).toContain(DEVICES_COPY.list.emptyTitle)
    expect(t).toContain("DEMO plug in a radio board")
    expect(html).toContain('href="/demo#/devices/add"')
    expect(html).not.toMatch(/href="#(?!\/)/)
  })

  it("takes the shell's heading levels inside the L4 window", () => {
    const html = render(newStore(), "/devices", true)
    expect(html).toMatch(/<h3[^>]*>Devices<\/h3>/)
    expect(html).not.toMatch(/<h[12][\s>]/)
  })

  it("a plugged board shows in the table with its labelled state, and the consent asks right below", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    const t = text(render(store, "/devices"))
    expect(t).toContain("USB radio board")
    expect(t).toContain("needs setup")
    expect(t).toContain("likely")
    expect(t).toContain("Allow once?")
    expect(t).toContain("Allow once")
    expect(t).toContain("Not now")
    expect(t).not.toContain("DEMO plug in a radio board")
  })

  it("after the identify, the list points to the firmware offer on the board's page", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed" })
    store.scheduler.advance(TIMING.identifyMs)
    const html = render(store, "/devices")
    expect(text(html)).toContain(DEVICES_COPY.consent.identifiedTitle)
    expect(text(html)).toContain("NEEDS FIRMWARE")
    expect(html).toContain('href="/demo#/devices/radio-board"')
  })
})

describe("Device detail", () => {
  it("an unknown id is an honest 404", () => {
    const t = text(render(newStore(), "/devices/nope"))
    expect(t).toContain("No such device")
    expect(t).toContain("Back to Devices")
  })

  it("walks the steps: offer, typed confirmation, writing, region, ready", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    expect(text(render(store, BOARD))).toContain("Allow once?")

    store.dispatch({ type: "core/radioAllowed" })
    expect(text(render(store, BOARD))).toContain(DEVICES_COPY.consent.identifyingTitle)
    store.scheduler.advance(TIMING.identifyMs)

    let t = text(render(store, BOARD))
    expect(t).toContain("This board has no usable firmware.")
    expect(t).toContain("Erases")
    expect(t).toContain("Flash firmware…")
    expect(t).toContain("Ask the agent instead")
    expect(t).toContain("a long-range radio board")

    store.dispatch({ type: "devices/openFlash" })
    t = text(render(store, BOARD))
    expect(t).toContain("Type it exactly as shown, capitals included: USB radio board")
    expect(t).toContain("Still needed: tick both boxes and type the name exactly as shown.")
    expect(t).toContain("Flash now")

    store.dispatch({ type: "devices/flash", confirm: { checks: { erase: true, own: true }, typed: "USB radio board" } })
    expect(text(render(store, BOARD))).toContain(DEVICES_COPY.flash.startedTitle)
    store.scheduler.advance(TIMING.flashMs)

    t = text(render(store, BOARD))
    expect(t).toContain(DEVICES_COPY.flash.doneTitle)
    expect(t).toContain("Pick your region")
    for (const r of DEMO_WORLD.regions) expect(t).toContain(r)

    store.dispatch({ type: "core/radioRegionSet", region: "Europe" })
    t = text(render(store, BOARD))
    expect(t).toContain("STARTING")
    expect(t).toContain("Region: Europe.")
    store.scheduler.advance(TIMING.startingMs)
    t = text(render(store, BOARD))
    expect(t).toContain("LIVE")
    expect(t).toContain("See what it hears")
    expect(t).toContain("DEMO unplug the radio board")
  })

  it("the laptop says it also bridges radio and Wi-Fi once its radio is live (bootstrap rule)", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "devices/openFlash" })
    store.dispatch({ type: "devices/flash", confirm: { checks: { erase: true, own: true }, typed: "USB radio board" }, instant: true })
    expect(text(render(store, "/devices"))).not.toContain(DEVICE_COPY.ownBridges)
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    const t = text(render(store, "/devices"))
    expect(t).toContain(`${DEVICE_COPY.ownBridges}: ${DEVICES_COPY.own.whyHotspot}.`)
    expect(t).toContain("a radio board on USB")
    expect(t).toContain("1 device, connected.")
  })
})

describe("Add device", () => {
  it("one card per kind, the [DEMO] button on the radio card, and no pair codes or addresses", () => {
    const html = render(newStore(), "/devices/add")
    expect(html).toMatch(/<h1[^>]*>Add device<\/h1>/)
    const t = text(html)
    for (const title of ["Long-range radio board over USB", "Bluetooth device", "Phone or laptop", "Handheld radio"]) expect(t).toContain(title)
    expect(t).toContain("DEMO plug in a radio board")
    expect(t).not.toMatch(/pair code|\.local\b/i)
  })
})
