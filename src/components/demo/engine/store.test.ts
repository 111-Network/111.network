import { afterEach, describe, expect, it, vi } from "vitest"
import { createFakeDriver } from "./scheduler"
import { createDemoStore } from "./store"
import { TIMING } from "./core"
import { DEMO_WORLD } from "./world"

/** A tiny window: location, history and listeners; pushState never fires hashchange (like the App Router). */
function fakeWindow(hash: string) {
  const listeners = new Map<string, Set<() => void>>()
  const pushes: string[] = []
  const location = { pathname: "/demo", search: "?device=laptop", hash }
  const setUrl = (url: string) => {
    const i = url.indexOf("#")
    location.hash = i < 0 ? "" : url.slice(i)
  }
  const win = {
    location,
    history: {
      pushState: (_s: unknown, _t: string, url: string) => {
        pushes.push(`push ${url}`)
        setUrl(url)
      },
      replaceState: (_s: unknown, _t: string, url: string) => {
        pushes.push(`replace ${url}`)
        setUrl(url)
      },
    },
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(fn)
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn)
    },
  }
  const fire = (type: string) => {
    for (const fn of listeners.get(type) ?? []) fn()
  }
  const count = () => [...listeners.values()].reduce((n, s) => n + s.size, 0)
  return { win, pushes, fire, count, location }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("store: url router", () => {
  it("has no route until start(); an empty hash becomes #/overview in place", () => {
    const w = fakeWindow("")
    vi.stubGlobal("window", w.win)
    const store = createDemoStore(DEMO_WORLD, { router: "url", driver: null })
    expect(store.getSnapshot().core.route).toBeNull()
    store.start()
    expect(store.getSnapshot().core.route?.view).toBe("overview")
    expect(w.pushes).toEqual(["replace /demo?device=laptop#/overview"])
    store.stop()
    expect(w.count()).toBe(0)
  })

  it("navigate() pushes a history entry; hashchange and popstate are followed without a push", () => {
    const w = fakeWindow("#/devices")
    vi.stubGlobal("window", w.win)
    const store = createDemoStore(DEMO_WORLD, { router: "url", driver: null })
    store.start()
    expect(store.getSnapshot().core.route?.view).toBe("devices")
    expect(w.pushes).toEqual([])

    store.navigate("/nearby")
    expect(w.location.hash).toBe("#/nearby")
    expect(w.pushes).toEqual(["push /demo?device=laptop#/nearby"])

    w.location.hash = "#/messages/ada"
    w.fire("hashchange")
    expect(store.getSnapshot().core.route).toMatchObject({ view: "conversation", peer: "ada" })

    w.location.hash = "#/settings/l2"
    w.fire("popstate")
    expect(store.getSnapshot().core.route).toMatchObject({ view: "settings-layer", layer: 2 })
    expect(w.pushes).toHaveLength(1)
    expect(store.hrefFor("/kb")).toBe("#/kb")
    store.stop()
  })

  it("ignores a Back that leaves /demo (Next keeps the page mounted through that popstate)", () => {
    const w = fakeWindow("#/devices")
    vi.stubGlobal("window", w.win)
    const store = createDemoStore(DEMO_WORLD, { router: "url", driver: null })
    store.start()
    // Back to the home page's Layer 4 anchor: another page's hash, not a route.
    w.location.pathname = "/"
    w.location.hash = "#layer-4"
    w.fire("popstate")
    w.fire("hashchange")
    expect(store.getSnapshot().core.route).toMatchObject({ view: "devices" })
    expect(w.pushes).toEqual([])
    // A late navigation (a scheduled step, a click during the transition) never writes the home page's URL.
    store.navigate("/nearby")
    expect(w.pushes).toEqual([])
    expect(w.location.hash).toBe("#layer-4")
    // Forward again onto /demo: followed as usual.
    w.location.pathname = "/demo"
    w.location.hash = "#/kb"
    w.fire("popstate")
    expect(store.getSnapshot().core.route).toMatchObject({ view: "kb" })
    expect(w.pushes).toEqual([])
    store.stop()
  })

  it("a route change made by a reducer is written to the URL too", () => {
    const w = fakeWindow("#/settings/l2")
    vi.stubGlobal("window", w.win)
    const store = createDemoStore(DEMO_WORLD, { router: "url", driver: null })
    store.start()
    store.dispatch({ type: "core/agentPrefill", text: "Tell me about identity.", from: "Identity · L2" })
    expect(w.location.hash).toBe("#/")
    store.stop()
  })
})

describe("store: memory router", () => {
  it("never touches location", () => {
    const w = fakeWindow("#/kb")
    vi.stubGlobal("window", w.win)
    const store = createDemoStore(DEMO_WORLD, { router: "memory", layout: "rail", initialPath: "/nearby", driver: null })
    store.start()
    expect(store.getSnapshot().core.route?.view).toBe("nearby")
    store.navigate("/")
    expect(store.getSnapshot().core.route?.view).toBe("agent")
    expect(w.pushes).toEqual([])
    expect(w.count()).toBe(0)
    expect(w.location.hash).toBe("#/kb")
    store.stop()
  })
})

describe("store: clock lifecycle", () => {
  it("start() attaches the driver, stop() freezes pending steps", () => {
    const d = createFakeDriver()
    const store = createDemoStore(DEMO_WORLD, { router: "memory", driver: d })
    store.start()
    store.dispatch({ type: "core/internetConnected" })
    store.stop()
    d.advance(TIMING.startingMs * 3)
    expect(store.getSnapshot().core.services.find((s) => s.id === "gateway")?.state).toBe("starting")
    store.start()
    d.advance(TIMING.startingMs)
    expect(store.getSnapshot().core.services.find((s) => s.id === "gateway")?.state).toBe("live")
    store.stop()
  })

  it("store.schedule runs functions and actions on the virtual clock", () => {
    const store = createDemoStore(DEMO_WORLD, { router: "memory", driver: null })
    const log: string[] = []
    store.schedule(100, () => log.push("fn"))
    store.schedule(200, { type: "core/setMode", mode: "advanced" })
    const cancel = store.schedule(300, () => log.push("never"))
    cancel()
    store.scheduler.advance(1000)
    expect(log).toEqual(["fn"])
    expect(store.getSnapshot().core.mode).toBe("advanced")
  })
})
