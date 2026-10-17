// Server-render smoke tests of Nearby and the Internet gateway page: they render in node, take the
// shell's heading levels, show the honest empty state before the radio, the demo notes on heard
// nodes, the relay line, the home hub apart, and the overlay role with an unchanged node chip.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DEMO_ACTIONS } from "../../copy/core"
import { GATEWAY_COPY } from "../../copy/gateway"
import { NEARBY_COPY } from "../../copy/nearby"
import { DemoStoreProvider } from "../../engine/react"
import { PATHS, parsePath } from "../../engine/router"
import { createDemoStore, type DemoStore } from "../../engine/store"
import { DEMO_WORLD } from "../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../shell/context"
import GatewayPage from "../services/gateway/index"
import NearbyView from "./index"

const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>

const shell = (embedded: boolean): ShellContextValue => ({
  mainId: "m",
  mainRef: { current: null },
  announce: () => {},
  embedded,
  headingBase: embedded ? 3 : 1,
})

function render(store: DemoStore, page: "nearby" | "gateway", embedded = false): string {
  const live: DemoStore = { ...store, getServerSnapshot: store.getSnapshot }
  const body =
    page === "nearby"
      ? createElement(NearbyView)
      : createElement(GatewayPage, { route: parsePath(PATHS.service("gateway")), id: "gateway" })
  return renderToString(createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, body)))
}

const newStore = (path = "/nearby") => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: path })
const text = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")

function radioUp(s: DemoStore): void {
  s.dispatch({ type: "core/radioPlugged" })
  s.dispatch({ type: "core/radioAllowed", instant: true })
  s.dispatch({ type: "core/radioFlash", instant: true })
  s.dispatch({ type: "core/radioRegionSet", region: DEMO_WORLD.regions[0], instant: true })
  s.scheduler.runUntilIdle()
}

describe("Nearby render", () => {
  it("before the radio: the honest empty state, RADAR | LIST, no listen button, no demo node", () => {
    const html = render(newStore(), "nearby")
    expect(html).toMatch(/<h1[^>]*>Nearby<\/h1>/)
    const t = text(html)
    expect(t).toContain(NEARBY_COPY.empty.noBoard.title)
    expect(t).toContain(NEARBY_COPY.view.radar)
    expect(t).toContain(NEARBY_COPY.view.list)
    expect(t).not.toContain(DEMO_ACTIONS.listen)
    expect(t).not.toContain("demo node")
    expect(t).toContain(DEMO_ACTIONS.internet)
  })

  it("takes the L4 window's heading levels", () => {
    const html = render(newStore(), "nearby", true)
    expect(html).toMatch(/<h3[^>]*>Nearby<\/h3>/)
    expect(html).not.toMatch(/<h[12][\s>]/)
  })

  it("after the radio, LIST: the heard nodes with demo notes and the relay line; the listen button", () => {
    const s = newStore()
    radioUp(s)
    s.dispatch({ type: "nearby/setMode", mode: "list" })
    const t = text(render(s, "nearby"))
    expect(t).toContain(NEARBY_COPY.summary(3))
    expect(t).toContain("Ridge repeater")
    expect(t).toContain(NEARBY_COPY.relay)
    expect(t.match(/demo node/g)?.length).toBe(3)
    expect(t).toContain(DEMO_ACTIONS.listen)
  })

  it("after a SEND, the home hub is shown apart as the home link, not as a nearby node", () => {
    const s = newStore()
    s.dispatch({ type: "messages/send", peer: "ada", text: "hello" })
    s.scheduler.runUntilIdle()
    s.dispatch({ type: "nearby/setMode", mode: "list" })
    const t = text(render(s, "nearby"))
    expect(t).toContain(NEARBY_COPY.home.heading)
    expect(t).toContain(NEARBY_COPY.empty.noBoard.title)
  })

  it("while listening, the same button stops it and the line says so", () => {
    const s = newStore()
    radioUp(s)
    s.dispatch({ type: "nearby/listen" })
    const t = text(render(s, "nearby"))
    expect(t).toContain(NEARBY_COPY.listen.stop)
    expect(t).toContain(NEARBY_COPY.listen.soFar(""))
  })
})

describe("Internet gateway render", () => {
  it("offline: the demo action, a pure mesh node, the chip unchanged", () => {
    const html = render(newStore("/services/gateway"), "gateway")
    expect(html).toMatch(/<h1[^>]*>Internet gateway<\/h1>/)
    const t = text(html)
    expect(t).toContain(DEMO_ACTIONS.internet)
    expect(t).toContain(GATEWAY_COPY.role.meshNode)
    expect(t).toContain(GATEWAY_COPY.role.chipSame(DEMO_WORLD.self.badge))
    expect(t).toContain(GATEWAY_COPY.log.empty)
  })

  it("online: gateway role, the outbox flushed, the log, the chip still unchanged; disconnect offered", () => {
    const s = newStore("/services/gateway")
    s.dispatch({ type: "core/internetConnected", instant: true })
    const t = text(render(s, "gateway"))
    expect(t).toContain(GATEWAY_COPY.role.gateway)
    expect(t).toContain(GATEWAY_COPY.role.chipSame(DEMO_WORLD.self.badge))
    expect(t).toContain(GATEWAY_COPY.log.online)
    expect(t).toContain(GATEWAY_COPY.log.flushed)
    expect(t).toContain(GATEWAY_COPY.disconnect)
  })
})
