// Server-render smoke tests of the Storage page: it renders in node, its headings follow the shell,
// it prints the free-space order and the demo action, and what it prints follows the store.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DEMO_ACTIONS } from "../../../copy/core"
import { STORAGE_COPY, STORAGE_EXPORT_CHIP, STORAGE_FREE_ORDER } from "../../../copy/storage"
import { DemoStoreProvider } from "../../../engine/react"
import { PATHS, parsePath } from "../../../engine/router"
import { createDemoStore, type DemoStore } from "../../../engine/store"
import { DEMO_WORLD } from "../../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../../shell/context"
import StoragePage from "./index"

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
  const route = parsePath(PATHS.service("storage"))
  return renderToString(
    createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, createElement(StoragePage, { route, id: "storage" }))),
  )
}

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/services/storage" })
const text = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")

describe("Storage page render", () => {
  it("opens with the service title, the demo action, the gauge in words and the free-space order", () => {
    const html = render(newStore())
    expect(html).toMatch(/<h1[^>]*>Storage<\/h1>/)
    const t = text(html)
    expect(t).toMatch(new RegExp(`DEMO\\W* ${DEMO_ACTIONS.fetchMap}`))
    expect(t).toContain(STORAGE_COPY.fetch.radio)
    expect(t).toContain(STORAGE_COPY.gauge.words.room)
    for (const { text: rule } of STORAGE_FREE_ORDER) expect(t).toContain(rule)
    expect(t).toContain(STORAGE_EXPORT_CHIP)
    expect(t).toContain(STORAGE_COPY.sharedLog)
    expect(t).toContain(STORAGE_COPY.log.empty)
    expect(html).toContain('aria-label="Store gauge: room to spare.')
    expect(t).not.toMatch(/\d+ ?%/)
  })

  it("takes the L4 window's heading levels", () => {
    const html = render(newStore(), true)
    expect(html).toMatch(/<h3[^>]*>Storage<\/h3>/)
    expect(html).not.toMatch(/<h[12][\s>]/)
  })

  it("after the fetch: the map is stored with its demo note, the prune is logged and the gauge says room was freed", () => {
    const store = newStore()
    store.dispatch({ type: "storage/fetchMap" })
    store.scheduler.runUntilIdle()
    const t = text(render(store))
    expect(t).toContain(STORAGE_COPY.fetch.done)
    expect(t).toContain(STORAGE_COPY.fetch.already)
    expect(t).toContain(STORAGE_COPY.gauge.words.freed)
    expect(t).toContain("demo message")
    expect(t).toContain("regional map → freed")
    expect(t).toContain(`${STORAGE_COPY.hubs.map}: ${STORAGE_COPY.hubs.mapState.held}`)
  })
})
