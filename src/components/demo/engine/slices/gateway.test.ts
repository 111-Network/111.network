import { describe, expect, it } from "vitest"
import { gatewayLog, roleOf } from "../../views/services/gateway/model"
import { ownDevice, serviceById } from "../selectors"
import { createDemoStore, type DemoStore } from "../store"
import { DEMO_WORLD } from "../world"
import { TIMING } from "../core"
import type { DemoState } from "./index"
import { initialGateway, needsGateway, openSession, SESSION_LIMIT } from "./gateway"
import { NO_NEEDS } from "../types"

function setup(): DemoStore {
  return createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/services/gateway" })
}
const snap = (s: DemoStore): DemoState => s.getSnapshot()
const gw = (s: DemoStore) => serviceById(snap(s), "gateway")

describe("gateway: an overlay role earned by internet access", () => {
  it("opens offline: NOT SET, no session, a pure mesh node", () => {
    const s = setup()
    expect(snap(s).gateway).toEqual(initialGateway())
    expect(gw(s)?.state).toBe("unset")
    expect(roleOf(gw(s)?.state ?? "unset")).toBe("mesh node")
    expect(needsGateway()).toBe(NO_NEEDS)
  })

  it("connect: STARTING through the scheduler, then LIVE; a session opens; the node chip does not change", () => {
    const s = setup()
    const chip = ownDevice(snap(s), DEMO_WORLD).badge
    s.dispatch({ type: "core/internetConnected" })
    expect(gw(s)?.state).toBe("starting")
    expect(roleOf("starting")).toBe("checking")
    expect(openSession(snap(s).gateway)).toMatchObject({ n: 1, to: null })
    s.scheduler.advance(TIMING.startingMs)
    expect(gw(s)?.state).toBe("live")
    expect(roleOf("live")).toBe("gateway")
    expect(ownDevice(snap(s), DEMO_WORLD).badge).toBe(chip)
    expect(DEMO_WORLD.self.badge).toBe(chip)
  })

  it("the queue flushes on connect (messages reacts to the core event) and the session records it", () => {
    const s = setup()
    const queued = snap(s).messages.messages.filter((m) => m.dir === "own" && m.state === "queued" && !m.cancelled)
    expect(queued.length).toBeGreaterThan(0)
    s.dispatch({ type: "core/internetConnected", instant: true })
    const flushed = snap(s).core.events.filter((e) => e.cause === "queue-flushed")
    expect(flushed).toHaveLength(1)
    const ids = new Set(queued.map((m) => m.id))
    expect(snap(s).messages.messages.filter((m) => ids.has(m.id)).every((m) => m.state !== "queued")).toBe(true)
    expect(openSession(snap(s).gateway)?.flushedAt).toBe(flushed[0].at)
  })

  it("disconnect: a pure mesh node again; the session closes; connecting again opens session 2", () => {
    const s = setup()
    s.dispatch({ type: "core/internetConnected", instant: true })
    s.dispatch({ type: "core/internetLost" })
    expect(gw(s)?.state).toBe("unset")
    expect(snap(s).core.internet).toBe("offline")
    expect(openSession(snap(s).gateway)).toBeNull()
    expect(snap(s).gateway.sessions[0].to).not.toBeNull()
    const before = snap(s)
    s.dispatch({ type: "core/internetLost" })
    expect(snap(s)).toBe(before)
    s.dispatch({ type: "core/internetConnected", instant: true })
    expect(snap(s).gateway.sessions.map((x) => x.n)).toEqual([1, 2])
    // nothing waits any more, so the second time online flushes nothing
    expect(snap(s).gateway.sessions[1].flushedAt).toBeNull()
  })

  it("a second connect while online changes nothing", () => {
    const s = setup()
    s.dispatch({ type: "core/internetConnected", instant: true })
    const before = snap(s)
    s.dispatch({ type: "core/internetConnected", instant: true })
    expect(snap(s)).toBe(before)
  })

  it("keeps at most SESSION_LIMIT sessions, newest last", () => {
    const s = setup()
    for (let i = 0; i < SESSION_LIMIT + 3; i++) {
      s.dispatch({ type: "core/internetConnected", instant: true })
      s.dispatch({ type: "core/internetLost" })
    }
    const list = snap(s).gateway.sessions
    expect(list).toHaveLength(SESSION_LIMIT)
    expect(list[list.length - 1].n).toBe(SESSION_LIMIT + 3)
  })

  it("the log reads online, flushed, offline per session", () => {
    expect(gatewayLog([])).toEqual([])
    const lines = gatewayLog([{ n: 1, from: 0, to: 60_000, flushedAt: 0 }])
    expect(lines).toEqual(["09:00 reached the internet: this node is a gateway", "09:00 waiting messages went out", "09:01 internet lost: a pure mesh node again"])
  })
})
