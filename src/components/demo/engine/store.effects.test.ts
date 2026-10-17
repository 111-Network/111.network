// The store applies what a reducer RECORDED only once the reducer has returned: a reducer that throws
// leaves no timer armed and no follow-up queued, and what committed before the throw is published.
// The messages slice is replaced by one that throws on cue (slices/index.ts imports only these three).
import { describe, expect, it, vi } from "vitest"
import type { DemoAction } from "./slices"

const boom = vi.hoisted(() => ({ on: null as string | null }))

vi.mock("./slices/messages", () => ({
  initialMessages: () => ({}),
  needsMessages: () => [],
  reduceMessages: (state: object, action: DemoAction) => {
    if (boom.on !== null && action.type === boom.on) throw new Error("boom")
    return state
  },
}))

const { createDemoStore } = await import("./store")
const { DEMO_WORLD } = await import("./world")

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })

describe("store: recorded effects", () => {
  it("a throwing reducer commits nothing: no state, no timer, no follow-up", () => {
    const store = newStore()
    let woken = 0
    store.subscribe(() => woken++)
    boom.on = "core/internetConnected"
    expect(() => store.dispatch({ type: "core/internetConnected" })).toThrow("boom")
    // Core had recorded the gateway's STARTING -> LIVE timer and the internet-connected event.
    expect(store.getSnapshot().core.internet).toBe("offline")
    expect(store.scheduler.pending()).toEqual([])
    expect(woken).toBe(0)
    boom.on = null
    store.dispatch({ type: "core/setMode", mode: "advanced" })
    expect(store.getSnapshot().core.events).toEqual([])
    expect(woken).toBe(1)
  })

  it("a follow-up that throws clears the queue; what committed before it is still published", () => {
    const store = newStore()
    let woken = 0
    store.subscribe(() => woken++)
    boom.on = "core/emitEvent"
    expect(() =>
      store.dispatch({ type: "core/proposalAdded", proposal: { id: "p1", kind: "setup", title: "Set up the bridge", body: "" } }),
    ).toThrow("boom")
    expect(store.getSnapshot().core.proposals.map((p) => p.id)).toEqual(["p1"])
    expect(store.getSnapshot().core.events).toEqual([])
    expect(woken).toBe(1)
    boom.on = null
    store.dispatch({ type: "core/setMode", mode: "advanced" })
    // The dropped emitEvent did not run on this unrelated dispatch.
    expect(store.getSnapshot().core.events).toEqual([])
  })
})
