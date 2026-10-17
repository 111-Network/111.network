// The demo shell's pure helpers (nav model, layout decision, route -> module keys, service page
// matrix, live-region throttle) and a server-render smoke test: the whole shell renders in node,
// where `window` does not exist, so any window access during render would throw here.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DemoApp } from "../demo-app"
import { DemoWindow } from "../demo-window"
import { initialCore } from "../engine/core"
import { DemoStoreProvider } from "../engine/react"
import { parsePath, PATHS } from "../engine/router"
import { createDemoStore, type DemoStore } from "../engine/store"
import type { DemoService } from "../engine/world"
import { DEMO_WORLD } from "../engine/world"
import { VIEW_REGISTRY } from "../views/registry"
import { createAnnouncer, createRegionWriter, type SetTimer } from "./announcer"
import { SHELL_COPY } from "./copy"
import { DEMO_MAIN_ID } from "./frame-ids"
import { canCollapse, isDrawerActive, isFillRoute, isRail, isWide, needsMeasure, resolveLayout, showsMenu, WIDE_MIN_PX } from "./layout"
import { glyphOf, inSettings, meetsMode, minModeFor, NAV, visibleNav } from "./nav"
import { registryKeyOf, servicePageOf, VIEW_KEYS } from "./route-keys"
import { handoffPrompt, kbRouteOf, servicePageState } from "./service-page"
import { Shell } from "./shell"
import { ShellProvider, type ShellContextValue } from "./context"
import { ViewPlaceholder } from "./view-placeholder"
import { ServicePageFrame } from "../views/services/frame"

/** The provider with optional children, so createElement can take them as its third argument. */
const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>

const core = (layout: "auto" | "rail" | "docked" | "drawer", railCollapsed = false) => ({ layout, railCollapsed })

describe("nav model (real lib/nav.ts)", () => {
  it("has the five core rows in the real order, then Essentials and the ten layer pages", () => {
    expect(NAV.filter((i) => i.section === "core").map((i) => i.label)).toEqual(["Overview", "Agent", "Devices", "Nearby", "Messages"])
    const settings = NAV.filter((i) => i.section === "settings")
    expect(settings.map((i) => i.href)).toEqual([PATHS.settings, ...Array.from({ length: 10 }, (_, n) => `/settings/l${n}`)])
    expect(settings[3].label).toBe("Identity · L2")
  })

  it("shows Essentials and Messaging & data in simple mode, all ten layer pages in advanced", () => {
    const simple = visibleNav("simple", DEMO_WORLD.services)
    const advanced = visibleNav("advanced", DEMO_WORLD.services)
    expect(simple.settings.map((i) => i.label)).toEqual(["Essentials", "Messaging & data · L5"])
    expect(advanced.settings).toHaveLength(11)
    expect(simple.core).toEqual(advanced.core)
  })

  it("lists one service row per registry record, in registry order, and splits off what cannot run here", () => {
    const nav = visibleNav("simple", DEMO_WORLD.services)
    expect(nav.services.map((s) => s.id)).toEqual(DEMO_WORLD.services.map((s) => s.id))
    expect(nav.services.find((s) => s.id === "radio")).toMatchObject({ label: "Long-range radio", href: "/services/radio", state: "unset" })
    const away: DemoService = { ...DEMO_WORLD.services[0], canRunHere: false }
    const split = visibleNav("simple", [away, ...DEMO_WORLD.services.slice(1)])
    expect(split.unavailable.map((s) => s.id)).toEqual(["agent"])
    expect(split.services.map((s) => s.id)).not.toContain("agent")
  })

  it("meetsMode, glyphOf and inSettings", () => {
    expect(meetsMode("simple", "advanced")).toBe(false)
    expect(meetsMode("advanced", "advanced")).toBe(true)
    expect(meetsMode("simple", undefined)).toBe(true)
    expect(glyphOf("Overview")).toBe("OV")
    expect(glyphOf("Local AI agent")).toBe("LO")
    expect(inSettings(parsePath("/settings"))).toBe(true)
    expect(inSettings(parsePath("/settings/l3"))).toBe(true)
    expect(inSettings(parsePath("/services/radio"))).toBe(false)
    expect(inSettings(null)).toBe(false)
  })

  it("marks the advanced layer pages, never Essentials, L5 or the core views", () => {
    expect(minModeFor(parsePath("/settings/l2"))).toBe("advanced")
    expect(minModeFor(parsePath("/settings/l5"))).toBeUndefined()
    expect(minModeFor(parsePath("/settings"))).toBeUndefined()
    expect(minModeFor(parsePath("/overview"))).toBeUndefined()
    expect(minModeFor(parsePath("/services/bridge"))).toBeUndefined()
    expect(minModeFor(null)).toBeUndefined()
  })
})

describe("layout decision from the shell root's width (port rule 3)", () => {
  it("docks from 1024 px of shell width", () => {
    expect(WIDE_MIN_PX).toBe(1024)
    expect(isWide(1023.9)).toBe(false)
    expect(isWide(1024)).toBe(true)
  })

  it("auto: unknown before measuring, then docked / rail / drawer", () => {
    expect(resolveLayout(core("auto"), null)).toBe("unknown")
    expect(resolveLayout(core("auto"), true)).toBe("docked")
    expect(resolveLayout(core("auto", true), true)).toBe("rail")
    expect(resolveLayout(core("auto", true), false)).toBe("drawer")
    expect(needsMeasure(core("auto"))).toBe(true)
  })

  it("a forced layout ignores the width and is never measured (the L4 teaser's rail)", () => {
    for (const wide of [null, true, false]) {
      expect(resolveLayout(core("rail"), wide)).toBe("rail")
      expect(resolveLayout(core("drawer"), wide)).toBe("drawer")
      expect(resolveLayout(core("docked", true), wide)).toBe("docked")
    }
    expect(needsMeasure(core("rail"))).toBe(false)
  })

  it("drawer, rail, collapse and MENU follow the layout", () => {
    expect(isDrawerActive("drawer", true)).toBe(true)
    expect(isDrawerActive("drawer", false)).toBe(false)
    expect(isDrawerActive("docked", true)).toBe(false)
    expect(isDrawerActive("unknown", true)).toBe(false)
    expect(isRail("rail", core("rail"))).toBe(true)
    expect(isRail("unknown", core("auto", true))).toBe(true)
    expect(isRail("docked", core("auto", true))).toBe(false)
    expect(canCollapse(core("auto"), "docked")).toBe(true)
    expect(canCollapse(core("auto"), "drawer")).toBe(false)
    expect(canCollapse(core("rail"), "rail")).toBe(false)
    expect(showsMenu("drawer")).toBe(true)
    expect(showsMenu("unknown")).toBe(true)
    expect(showsMenu("docked")).toBe(false)
    expect(showsMenu("rail")).toBe(false)
  })

  it("only the Agent fills the main area", () => {
    expect(isFillRoute(parsePath("/"))).toBe(true)
    expect(isFillRoute(parsePath("/overview"))).toBe(false)
    expect(isFillRoute(null)).toBe(false)
  })
})

describe("route -> registry key -> module", () => {
  it("maps every route shape to its module key", () => {
    const cases: [string, string][] = [
      ["/", "agent"],
      ["/overview", "overview"],
      ["/overview#needs-you", "overview"],
      ["/devices", "devices"],
      ["/devices/radio-board", "devices"],
      ["/nearby", "nearby"],
      ["/messages", "messages"],
      ["/messages/ada", "messages"],
      ["/kb", "kb"],
      ["/kb/concepts", "kb"],
      ["/kb/concepts/thin-bridge", "kb"],
      ["/services/radio", "services"],
      ["/services/gateway", "services"],
      ["/services/bridge", "bridge"],
      ["/services/storage", "storage"],
      ["/services/repairs", "repairs"],
      ["/settings", "settings"],
      ["/settings/l9", "settings"],
      ["/settings/l10", "not-found"],
      ["/nowhere", "not-found"],
    ]
    for (const [path, key] of cases) expect({ path, key: registryKeyOf(parsePath(path)) }).toEqual({ path, key })
  })

  it("the registry has a module for every key", () => {
    expect(Object.keys(VIEW_REGISTRY).sort()).toEqual([...VIEW_KEYS].sort())
    for (const k of VIEW_KEYS) expect(VIEW_REGISTRY[k]).toBeTruthy()
  })

  it("the services dispatcher picks the custom pages and the template", () => {
    expect(servicePageOf("bridge")).toBe("bridge")
    expect(servicePageOf("storage")).toBe("storage")
    expect(servicePageOf("repairs")).toBe("repairs")
    expect(servicePageOf("gateway")).toBe("gateway")
    for (const id of ["agent", "model", "mesh", "radio", "kb", "messaging", "unknown"]) expect(servicePageOf(id)).toBe("template")
  })
})

describe("service page matrix (real views/services/model.ts)", () => {
  const svc = (id: string) => {
    const s = DEMO_WORLD.services.find((x) => x.id === id)
    if (!s) throw new Error(id)
    return s
  }

  it("NOT SET offers the agent hand-off; the gateway has no setup step", () => {
    expect(servicePageState(svc("radio"))).toEqual({ body: "unset", handoff: { goal: "setup", label: "Set up with the agent" }, recipePath: "/kb/recipes/set-up-a-radio-board" })
    expect(servicePageState(svc("gateway"))).toMatchObject({ body: "unset", handoff: null, recipePath: "/kb/concepts/gateway-role" })
  })

  it("LIVE, STARTING, ERROR and not available on this device", () => {
    expect(servicePageState(svc("agent"))).toMatchObject({ body: "live", handoff: null })
    expect(servicePageState({ ...svc("mesh"), state: "starting" })).toMatchObject({ body: "starting", handoff: null })
    expect(servicePageState({ ...svc("mesh"), state: "error" })).toMatchObject({ body: "error", handoff: { goal: "fix", label: "Fix with the agent" } })
    expect(servicePageState({ ...svc("radio"), canRunHere: false })).toMatchObject({ body: "unavailable", handoff: null })
  })

  it("knowledge base links and prepared prompts", () => {
    expect(kbRouteOf(null)).toBeNull()
    expect(kbRouteOf("concepts")).toBeNull()
    expect(kbRouteOf("concepts/")).toBeNull()
    expect(kbRouteOf("local-models/small-local-model")).toBe("/kb/local-models/small-local-model")
    expect(handoffPrompt("setup", "radio")).toBe("Set up the long-range radio on this node and test it.")
    expect(handoffPrompt("fix", "mesh")).toBe("Fix the mesh link on this node.")
  })

  it("every service with a recipe points at a note the knowledge base view must provide", () => {
    const notes = DEMO_WORLD.services.map((s) => kbRouteOf(s.kb)).filter((p): p is string => p !== null)
    for (const p of notes) expect(parsePath(p).view).toBe("kb-note")
  })
})

/** A fake timer queue on a fake clock. */
function fakeTimers() {
  let now = 0
  const queue: { at: number; fn: () => void }[] = []
  const setTimer: SetTimer = (fn, ms) => {
    const t = { at: now + ms, fn }
    queue.push(t)
    return () => {
      const i = queue.indexOf(t)
      if (i >= 0) queue.splice(i, 1)
    }
  }
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      queue.sort((a, b) => a.at - b.at)
      const next = queue[0]
      if (!next || next.at > end) break
      queue.shift()
      now = next.at
      next.fn()
    }
    now = end
  }
  return { setTimer, advance, now: () => now, pending: () => queue.length }
}

describe("live region (real app/LiveRegion.tsx)", () => {
  it("lets one message through per interval and keeps only the newest held one", () => {
    const t = fakeTimers()
    const said: string[] = []
    const announce = createAnnouncer({ emit: (x) => said.push(x), now: t.now, setTimer: t.setTimer })
    announce("one")
    announce("two")
    announce("three")
    expect(said).toEqual(["one"])
    t.advance(1999)
    expect(said).toEqual(["one"])
    t.advance(1)
    expect(said).toEqual(["one", "three"])
    t.advance(5000)
    announce("four")
    expect(said).toEqual(["one", "three", "four"])
  })

  it("ignores empty text and drops a held message on dispose", () => {
    const t = fakeTimers()
    const said: string[] = []
    const announce = createAnnouncer({ emit: (x) => said.push(x), now: t.now, setTimer: t.setTimer })
    announce("")
    announce("a")
    announce("b")
    announce.dispose()
    t.advance(10_000)
    expect(said).toEqual(["a"])
    expect(t.pending()).toBe(0)
  })

  it("repeats the same sentence by emptying the region first", () => {
    const t = fakeTimers()
    const region: string[] = []
    const writer = createRegionWriter({ set: (x) => region.push(x), setTimer: t.setTimer })
    writer.show("Opened Devices.")
    writer.show("Opened Devices.")
    expect(region).toEqual(["Opened Devices.", ""])
    t.advance(80)
    expect(region).toEqual(["Opened Devices.", "", "Opened Devices."])
  })
})

describe("server render (node: no window)", () => {
  it("runs where there is no window at all", () => {
    expect(typeof window).toBe("undefined")
    expect(typeof document).toBe("undefined")
  })

  it("renders the shell chrome with an empty main for a memory store, without starting it", () => {
    const store = createDemoStore(DEMO_WORLD, { router: "memory", layout: "auto", initialPath: "/devices", driver: null })
    const html = renderToString(createElement(Provider, { store }, createElement(Shell, { mainId: "m", embedded: false })))
    expect(store.isStarted()).toBe(false)
    // The node chip: plain device words, never a category code; the dot always labelled.
    expect(html).toContain("Workshop laptop")
    expect(html).toContain(">LAPTOP</span>")
    expect(html).toContain(SHELL_COPY.node.caption)
    expect(html).toContain(">LIVE</span>")
    // Core rows, a service row with its state word, the settings group, the mode switch.
    for (const label of ["Overview", "Agent", "Devices", "Nearby", "Messages", "Local AI agent", "Long-range radio", "NOT SET", "Settings", "SIMPLE", "ADVANCED"]) {
      expect(html).toContain(label)
    }
    expect(html).toContain('role="radiogroup" aria-label="Interface mode"')
    // Before measuring: docked markup hidden below 1024 px by a container query, MENU hidden from 1024 px.
    expect(html).toContain('data-layout="unknown"')
    expect(html).toContain("@max-[1024px]:hidden")
    expect(html).toContain("@min-[1024px]:hidden")
    expect(html).toContain(">MENU<")
    // The server snapshot has no route: chrome only, no view, no title.
    expect(html).toMatch(/<main id="m" tabindex="-1"[^>]*><div class="[^"]*"><\/div><\/main>/)
    expect(html).toContain('role="status" aria-live="polite"')
    expect(html).toContain("@container")
    expect(html).not.toMatch(/\bfixed\b/)
    // The shell header is not a second banner (the /demo site bar is the page's banner).
    expect(html).not.toContain("<header")
    expect(html).toContain('<nav aria-label="Main"')
  })

  it("renders the forced rail of the L4 window: no MENU, no collapse, glyph rows", () => {
    const html = renderToString(createElement(DemoWindow, { initialPath: "/nearby" }))
    expect(html).toContain('data-layout="rail"')
    expect(html).not.toContain(">MENU<")
    expect(html).not.toContain(SHELL_COPY.rail.collapse)
    expect(html).toContain('title="Overview"')
    expect(html).toContain(">OV</span>")
    // Memory router links point at the full demo.
    expect(html).toContain('href="/demo#/overview"')
  })

  it("the L4 window is embedded: no page landmarks of its own inside the home page's <main>", () => {
    const html = renderToString(createElement(DemoWindow, { initialPath: "/nearby" }))
    expect(html).not.toContain("<main")
    expect(html).not.toContain("<header")
    expect(html).toContain(`role="region" aria-label="${SHELL_COPY.embedded.region}"`)
    expect(html).toContain(`<nav aria-label="${SHELL_COPY.nav.landmarkEmbedded}"`)
    expect(html).not.toContain(SHELL_COPY.skip)
  })

  it("the rail never shows a state by colour alone: a state mark and the state word in the tooltip", () => {
    const html = renderToString(createElement(DemoWindow, { initialPath: "/nearby" }))
    expect(html).toContain('title="Long-range radio: NOT SET"')
    expect(html).toContain('title="Local AI agent: LIVE"')
    expect(html).toMatch(/aria-hidden="true" class="[^"]*">N<\/span>/)
    expect(html).toMatch(/aria-hidden="true" class="[^"]*">L<\/span>/)
    expect(html).toContain(`title="${SHELL_COPY.node.railTitle("Workshop laptop", "LIVE")}"`)
  })

  it("renders the /demo island (url router) without reading the hash on the server", () => {
    const html = renderToString(createElement(DemoApp))
    expect(html).toContain(`<main id="${DEMO_MAIN_ID}"`)
    expect(html).toContain('href="#/overview"')
    // The page renders its own skip button; the island does not repeat it.
    expect(html).not.toContain(SHELL_COPY.skip)
  })

  it("view headings follow the shell: h1 on /demo, h3 inside the L4 window", () => {
    const store = createDemoStore(DEMO_WORLD, { router: "memory", driver: null })
    const shellCtx = (embedded: boolean): ShellContextValue => ({
      mainId: "m",
      mainRef: { current: null },
      announce: () => {},
      embedded,
      headingBase: embedded ? 3 : 1,
    })
    const render = (embedded: boolean, child: ReturnType<typeof createElement>) =>
      renderToString(createElement(Provider, { store }, createElement(ShellProvider, { value: shellCtx(embedded) }, child)))
    expect(render(false, createElement(ViewPlaceholder, { kicker: "k", title: "T" }))).toMatch(/<h1[^>]*>T<\/h1>/)
    expect(render(true, createElement(ViewPlaceholder, { kicker: "k", title: "T" }))).toMatch(/<h3[^>]*>T<\/h3>/)
    const frame = render(true, createElement(ServicePageFrame, { id: "radio" }))
    expect(frame).toMatch(/<h3[^>]*>Long-range radio<\/h3>/)
    expect(frame).toMatch(/<h4 class="sr-only">Setup<\/h4>/)
    expect(render(false, createElement(ServicePageFrame, { id: "radio" }))).toMatch(/<h2 class="sr-only">Setup<\/h2>/)
  })

  it("the initial core of a url store has no route (the shell shows no view until start)", () => {
    expect(initialCore(DEMO_WORLD, { layout: "auto", route: null }).route).toBeNull()
  })
})
