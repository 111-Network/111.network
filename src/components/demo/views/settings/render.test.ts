// Server-render smoke tests of Settings: Essentials, a plain layer page, Install & updates (L1),
// Identity (L2) and Messaging & data (L5) render in node, take the shell's heading levels, follow
// the store, and keep the §6.8 rules in what they print.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DemoStoreProvider } from "../../engine/react"
import { parsePath } from "../../engine/router"
import { createDemoStore, type DemoStore } from "../../engine/store"
import { DEMO_WORLD } from "../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../shell/context"
import SettingsView from "./index"

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
  const route = parsePath(path)
  return renderToString(
    createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, createElement(SettingsView, { route }))),
  )
}

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })
const text = (html: string) => html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ")

function expectHonest(html: string) {
  const t = text(html)
  expect(t).not.toMatch(/\b111 [a-z]/)
  expect(t).not.toMatch(/\.local\b/)
  expect(t).not.toMatch(/\b\d+ words\b/)
  expect(t).not.toMatch(/pair code/i)
  expect(t).not.toMatch(/coming/i)
  expect(html).not.toMatch(/href="#(?!\/)/)
}

describe("Settings view render", () => {
  it("Essentials: five rows, the demo update button, restart, sharing", () => {
    const html = render(newStore(), "/settings")
    expect(html).toMatch(/<h1[^>]*>Settings<\/h1>/)
    const t = text(html)
    for (const label of ["Node name", "View mode", "Identity backup", "Restart node", "Check for updates", "Share on this network"]) {
      expect(t).toContain(label)
    }
    expect(t).toContain("DEMO check for updates")
    expect(t).toContain("Back up any time from the node itself.")
    expect(html).toContain('value="Workshop laptop"')
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('href="/demo#/settings/l1"')
    expect(html).toContain('href="/demo#/settings/l2"')
    expectHonest(html)
  })

  it("a layer page: description, status, how it works, links and the ask button", () => {
    const html = render(newStore(), "/settings/l6")
    expect(html).toMatch(/<h1[^>]*>Transport<\/h1>/)
    const t = text(html)
    expect(t).toContain("Layer 6")
    expect(t).toContain("What it is")
    expect(t).toContain("Status this layer owns today")
    expect(t).toContain("How it works on this node")
    expect(t).toContain("On this dashboard")
    expect(t).toContain("Ask the agent about Transport")
    expect(t).toContain("nothing is sent until you send it")
    // Service rows carry their state word beside the dot.
    expect(t).toContain("NOT SET")
    expect(html).toContain('href="/demo#/services/bridge"')
    expectHonest(html)
  })

  it("Install & updates (L1): the steps, the demo switches and this device", () => {
    const store = newStore()
    const html = render(store, "/settings/l1")
    expect(html).toMatch(/<h1[^>]*>Install &amp; updates<\/h1>/)
    const t = text(html)
    expect(t).toContain("DEMO check for updates")
    expect(t).toContain("DEMO fail the next trial")
    expect(t).toContain("download and verify")
    expect(t).toContain("This node is up to date.")
    expect(t).toContain("No check in this session yet.")
    expect(t).toContain("laptop")
    expect(t).toContain("Wi-Fi that can host a hotspot")
    expect(t).not.toContain("demo message") // nothing has arrived yet
    expectHonest(html)

    store.dispatch({ type: "settings/updateCheck" })
    store.scheduler.advance(1400)
    const staged = text(render(store, "/settings/l1"))
    expect(staged).toContain("downloaded, signature checked")
    expect(staged).toContain("demo message") // the newer version is an incoming demo item
    store.scheduler.runUntilIdle()
    const done = text(render(store, "/settings/l1"))
    expect(done).toContain("healthy")
    expect(done).toContain("The new version passed its trial and is now the running one.")
    expect(done).toContain("trial passed: the new version is now running")
  })

  it("Identity (L2): the card plate with the grouped label, the name editor and the backup note", () => {
    const store = newStore()
    store.dispatch({ type: "core/renameNode", alias: "Bench node" })
    const html = render(store, "/settings/l2")
    expect(html).toMatch(/<h1[^>]*>Identity<\/h1>/)
    const t = text(html)
    expect(t).toContain(DEMO_WORLD.self.label)
    expect(t).toContain("Bench node")
    expect(t).toContain("issued by")
    expect(t).toContain("nobody")
    expect(t).toContain("stays here")
    expect(t).toContain("Back up any time from the node itself.")
    expect(html).toContain('value="Bench node"')
    expect(html).toContain('role="img"')
    expectHonest(html)
  })

  it("Messaging & data (L5): the home hub over Wi-Fi", () => {
    const html = render(newStore(), "/settings/l5")
    const t = text(html)
    expect(t).toContain("Workshop hub")
    expect(t).toContain("Wi-Fi")
    expect(html).toContain('href="/demo#/messages"')
    expectHonest(html)
  })

  it("takes the shell's heading levels inside the L4 window", () => {
    for (const path of ["/settings", "/settings/l1", "/settings/l2", "/settings/l9"]) {
      const html = render(newStore(), path, true)
      expect(html).toMatch(/<h3[^>]*>/)
      expect(html).toMatch(/<h4[^>]*>/)
      expect(html).not.toMatch(/<h[12][\s>]/)
    }
  })
})
