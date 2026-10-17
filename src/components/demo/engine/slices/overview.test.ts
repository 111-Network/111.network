// The Overview slice: no state of its own, and the two agent hand-offs ("Let the agent check this
// node", "Set up with the agent" on a NOT SET row) staged as a prefill that is never sent.
import { describe, expect, it } from "vitest"
import { handoffPrompt } from "../../shell/service-page"
import { createDemoStore } from "../store"
import { NO_NEEDS, type ServiceId } from "../types"
import { DEMO_WORLD } from "../world"
import { initialOverview, needsOverview, overviewPrompt } from "./overview"

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })

describe("overview slice", () => {
  it("keeps no state: one frozen empty object that never changes identity", () => {
    const store = newStore()
    const before = store.getSnapshot().overview
    expect(before).toBe(initialOverview())
    expect(Object.isFrozen(before)).toBe(true)
    store.dispatch({ type: "core/navigate", path: "/devices" })
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/internetConnected", instant: true })
    store.dispatch({ type: "overview/askAgent", goal: "check" })
    expect(store.getSnapshot().overview).toBe(before)
  })

  it("adds no needs-you rows of its own", () => {
    expect(needsOverview()).toBe(NO_NEEDS)
  })

  it("'Let the agent check this node' stages the real check prompt from Overview and opens the agent", () => {
    const store = newStore()
    const navBefore = store.getSnapshot().core.navCount
    store.dispatch({ type: "overview/askAgent", goal: "check" })
    const core = store.getSnapshot().core
    expect(core.prefill).toMatchObject({ text: "Check this node end to end and tell me what needs attention.", from: "Overview" })
    expect(core.route?.view).toBe("agent")
    expect(core.navCount).toBe(navBefore + 1)
  })

  it("'Set up with the agent' on the radio row stages the service page's own sentence, named after the service", () => {
    const store = newStore()
    store.dispatch({ type: "overview/askAgent", goal: "setup", id: "radio" })
    const core = store.getSnapshot().core
    expect(core.prefill).toMatchObject({ text: "Set up the long-range radio on this node and test it.", from: "Long-range radio" })
    // Pinned to the service page's hand-off, so the two buttons never say different things.
    expect(core.prefill?.text).toBe(handoffPrompt("setup", "radio"))
    expect(core.route?.view).toBe("agent")
  })

  it("nothing is sent: the prompt waits in the composer and no message or proposal appears", () => {
    const store = newStore()
    store.dispatch({ type: "overview/askAgent", goal: "check" })
    store.scheduler.runUntilIdle()
    const core = store.getSnapshot().core
    expect(core.prefill).not.toBeNull()
    const causes = core.events.map((e) => e.cause)
    expect(causes).not.toContain("message-sent")
    expect(causes).not.toContain("reply")
    expect(core.proposals).toEqual([])
  })

  it("offers setup only for a NOT SET service that is set up through the agent", () => {
    const store = newStore()
    const core = () => store.getSnapshot().core
    for (const id of ["agent", "gateway", "messaging"] as ServiceId[]) {
      store.dispatch({ type: "overview/askAgent", goal: "setup", id })
      expect({ id, prefill: core().prefill }).toEqual({ id, prefill: null })
    }
    // The radio once it is live: nothing left to set up.
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(core().services.find((s) => s.id === "radio")?.state).toBe("live")
    store.dispatch({ type: "overview/askAgent", goal: "setup", id: "radio" })
    expect(core().prefill).toBeNull()
    // The bridge is the next one the agent can set up.
    store.dispatch({ type: "overview/askAgent", goal: "setup", id: "bridge" })
    expect(core().prefill).toMatchObject({ text: "Set up the bridge on this node and test it.", from: "Bridge" })
  })

  it("overviewPrompt is pure and refuses services this device cannot run", () => {
    const away = DEMO_WORLD.services.map((s) => (s.id === "radio" ? { ...s, canRunHere: false } : s))
    expect(overviewPrompt({ type: "overview/askAgent", goal: "setup", id: "radio" }, { services: away })).toBeNull()
    expect(overviewPrompt({ type: "overview/askAgent", goal: "setup", id: "radio" }, { services: DEMO_WORLD.services })).toEqual({
      text: "Set up the long-range radio on this node and test it.",
      from: "Long-range radio",
    })
    expect(overviewPrompt({ type: "overview/askAgent", goal: "check" }, { services: [] })?.from).toBe("Overview")
  })
})
