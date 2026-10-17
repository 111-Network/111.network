// The repairs slice through a memory store and the virtual scheduler (plan §6.4 Repairs, W13, §6.8).
import { describe, expect, it } from "vitest"
import { HEAL_GATES } from "@/lib/heal"
import { REPAIRS_COPY } from "../../copy/repairs"
import { DAY } from "../clock"
import { needsYou, serviceById } from "../selectors"
import { createDemoStore, type DemoStore } from "../store"
import type { ServiceId } from "../types"
import { DEMO_WORLD } from "../world"
import type { DemoState } from "./index"
import {
  FAULT_ORDER,
  FAULT_SPEC,
  RAIL_LENGTH,
  REPAIRS_TIMING as T,
  canPassGate,
  initialRepairs,
  nextFaultId,
  proposalIdOf,
  reduceRepairs,
  simulateStatus,
  type RepairRun,
} from "./repairs"

const setup = (): DemoStore => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/services/repairs" })
const snap = (s: DemoStore): DemoState => s.getSnapshot()
const run = (s: DemoStore): RepairRun => {
  const r = snap(s).repairs.run
  if (r === null) throw new Error("no run")
  return r
}
const stateOf = (s: DemoStore, id: ServiceId) => serviceById(snap(s), id)?.state
const reasonOf = (s: DemoStore, id: ServiceId) => serviceById(snap(s), id)?.reason
const causes = (s: DemoStore): string[] => snap(s).core.events.map((e) => e.cause)
const repairSteps = (s: DemoStore) => s.scheduler.pending().filter((p) => p.key?.startsWith("repairs:"))
const proposal = (s: DemoStore, id: string) => snap(s).core.proposals.find((p) => p.id === id)

/** Simulate the first fault and let the agent finish: the good fix waits for approval. */
function toReady(s: DemoStore): void {
  s.dispatch({ type: "repairs/simulate" })
  s.scheduler.advance(T.diagnoseMs + T.buildMs + T.testMs)
}

/** From ready: approve here, let PR UPSTREAM pass; the fix waits for the maintainers. */
function toMaintainers(s: DemoStore): void {
  toReady(s)
  s.dispatch({ type: "repairs/passGate", index: 0 })
  s.scheduler.advance(T.gateMs)
}

describe("repairs slice: the opening state", () => {
  it("nothing is broken, nothing runs, nothing is planned", () => {
    const s = setup()
    expect(snap(s).repairs).toEqual(initialRepairs())
    expect(stateOf(s, "repairs")).toBe("live")
    expect(simulateStatus(snap(s).repairs, snap(s).core)).toBe("ready")
    expect(nextFaultId(snap(s).repairs, snap(s).core)).toBe("outbox")
    expect(repairSteps(s)).toEqual([])
  })

  it("ignores actions that are not its own and returns its state itself", () => {
    const s = setup()
    const before = snap(s).repairs
    s.dispatch({ type: "core/setMode", mode: "advanced" })
    s.dispatch({ type: "repairs/passGate", index: 0 })
    s.dispatch({ type: "repairs/badFix" })
    s.dispatch({ type: "repairs/retry" })
    s.dispatch({ type: "repairs/properFix" })
    expect(snap(s).repairs).toBe(before)
  })

  it("every fault breaks a service of the registry, and the rotation covers all three", () => {
    expect(FAULT_ORDER).toEqual(["outbox", "links", "store"])
    for (const id of FAULT_ORDER) expect(DEMO_WORLD.services.some((x) => x.id === FAULT_SPEC[id].service)).toBe(true)
  })
})

describe("repairs slice: simulate a fault -> diagnose -> sandbox -> proposal", () => {
  it("breaks messaging with the fault's own reason, emits the fault and starts diagnosing", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate" })
    expect(stateOf(s, "messaging")).toBe("error")
    expect(reasonOf(s, "messaging")).toBe(REPAIRS_COPY.faults.outbox.reason)
    expect(causes(s)).toContain("fault")
    expect(run(s)).toMatchObject({ n: 1, fault: "outbox", target: "messaging", fix: "good", phase: "diagnosing", passed: 0 })
    expect(reasonOf(s, "repairs")).toBe(REPAIRS_COPY.reasons.working("message store"))
    expect(stateOf(s, "repairs")).toBe("live")
    expect(repairSteps(s)).toHaveLength(1)
    expect(snap(s).repairs.log[0].text).toBe(REPAIRS_COPY.log.noticed("messaging", REPAIRS_COPY.faults.outbox.symptom))
  })

  it("works on one fault at a time: a second simulate is ignored", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate" })
    const before = snap(s).repairs
    s.dispatch({ type: "repairs/simulate" })
    expect(snap(s).repairs).toBe(before)
    expect(stateOf(s, "mesh")).toBe("live")
    expect(simulateStatus(snap(s).repairs, snap(s).core)).toBe("working")
  })

  it("steps through the scheduler: diagnosing -> building -> testing -> ready, one step each", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate" })
    s.scheduler.advance(T.diagnoseMs - 1)
    expect(run(s).phase).toBe("diagnosing")
    s.scheduler.advance(1)
    expect(run(s).phase).toBe("building")
    expect(causes(s)).toContain("diagnosed")
    s.scheduler.advance(T.buildMs)
    expect(run(s).phase).toBe("testing")
    s.scheduler.advance(T.testMs)
    expect(run(s).phase).toBe("ready")
    expect(causes(s)).toContain("sandbox-passed")
  })

  it("writes one open proposal targeting the broken service, from repairs, listed in needs-you", () => {
    const s = setup()
    toReady(s)
    const id = proposalIdOf(1)
    expect(run(s).proposalId).toBe(id)
    expect(proposal(s, id)).toMatchObject({ kind: "fix", target: "messaging", from: "repairs", decision: null, title: REPAIRS_COPY.faults.outbox.title })
    expect(proposal(s, id)?.body).toBe(REPAIRS_COPY.proposalBody(REPAIRS_COPY.faults.outbox))
    const keys = needsYou(snap(s)).items.map((i) => i.key)
    expect(keys).toContain(`proposal:${id}`)
    expect(keys).toContain("service:messaging")
    expect(reasonOf(s, "repairs")).toBe(REPAIRS_COPY.reasons.waiting)
    expect(stateOf(s, "messaging")).toBe("error")
  })

  it("waits at the first human gate indefinitely: nothing is pending, a day later nothing moved", () => {
    const s = setup()
    toReady(s)
    expect(repairSteps(s)).toEqual([])
    const before = snap(s).repairs
    s.scheduler.advance(DAY)
    s.scheduler.runUntilIdle()
    expect(snap(s).repairs).toBe(before)
    expect(proposal(s, proposalIdOf(1))?.decision).toBeNull()
    expect(stateOf(s, "messaging")).toBe("error")
  })

  it("ignores a stale step of an older run", () => {
    const s = setup()
    toReady(s)
    const before = snap(s).repairs
    s.dispatch({ type: "repairs/step", run: 1 })
    s.dispatch({ type: "repairs/step", run: 7 })
    s.dispatch({ type: "repairs/gateStep", run: 1 })
    expect(snap(s).repairs).toBe(before)
  })
})

describe("repairs slice: the W13 gate rail", () => {
  it("APPROVE ON THIS NODE accepts the proposal: the service goes STARTING -> LIVE and PR UPSTREAM passes by itself", () => {
    const s = setup()
    toReady(s)
    s.dispatch({ type: "repairs/passGate", index: 0 })
    expect(proposal(s, proposalIdOf(1))?.decision?.decision).toBe("accepted")
    expect(stateOf(s, "messaging")).toBe("starting")
    expect(run(s)).toMatchObject({ phase: "approved", passed: 1 })
    expect(causes(s)).toContain("fix-applied")
    expect(snap(s).repairs.repaired.messaging).toBeDefined()
    expect(reasonOf(s, "repairs")).toBe(serviceById(snap(setup()), "repairs")?.reason)
    s.scheduler.advance(T.gateMs)
    expect(run(s).passed).toBe(2)
    s.scheduler.runUntilIdle()
    expect(stateOf(s, "messaging")).toBe("live")
  })

  it("waits for the maintainers indefinitely: only `next` passes MAINTAINERS", () => {
    const s = setup()
    toMaintainers(s)
    expect(run(s).passed).toBe(2)
    expect(HEAL_GATES[2].id).toBe("maintainers")
    s.scheduler.advance(DAY)
    s.scheduler.runUntilIdle()
    expect(run(s).passed).toBe(2)
    expect(repairSteps(s)).toEqual([])
    s.dispatch({ type: "repairs/passGate", index: 2 })
    expect(run(s).passed).toBe(3)
  })

  it("MERGED, VIA GATEWAY and NODE B RE-CHECKS pass one per step, then node B's owner waits indefinitely", () => {
    const s = setup()
    toMaintainers(s)
    s.dispatch({ type: "repairs/passGate", index: 2 })
    s.scheduler.advance(T.gateMs)
    expect(run(s).passed).toBe(4)
    s.scheduler.advance(T.gateMs)
    expect(run(s).passed).toBe(5)
    s.scheduler.advance(T.gateMs)
    expect(run(s).passed).toBe(6)
    s.scheduler.advance(DAY)
    s.scheduler.runUntilIdle()
    expect(run(s).passed).toBe(6)
    expect(snap(s).repairs.shared).toEqual([])
    expect(canPassGate(run(s), 6)).toBe(true)
  })

  it("node B's owner approves: the fix is shared, and the next fault can be simulated", () => {
    const s = setup()
    toMaintainers(s)
    s.dispatch({ type: "repairs/passGate", index: 2 })
    s.scheduler.runUntilIdle()
    s.dispatch({ type: "repairs/passGate", index: 6 })
    expect(run(s).passed).toBe(RAIL_LENGTH)
    expect(snap(s).repairs.shared).toEqual([{ id: proposalIdOf(1), fault: "outbox", at: expect.any(Number) }])
    expect(causes(s)).toContain("fix-shared")
    expect(simulateStatus(snap(s).repairs, snap(s).core)).toBe("ready")
    expect(nextFaultId(snap(s).repairs, snap(s).core)).toBe("links")
    s.dispatch({ type: "repairs/simulate" })
    expect(stateOf(s, "mesh")).toBe("error")
    expect(run(s)).toMatchObject({ n: 2, fault: "links", phase: "diagnosing" })
    expect(snap(s).repairs.shared).toHaveLength(1)
  })

  it("passes no station out of turn", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate" })
    const working = snap(s).repairs
    s.dispatch({ type: "repairs/passGate", index: 0 })
    expect(snap(s).repairs).toBe(working)
    s.scheduler.runUntilIdle()
    const ready = snap(s).repairs
    for (const index of [1, 2, 3, 6, 9]) s.dispatch({ type: "repairs/passGate", index })
    expect(snap(s).repairs).toBe(ready)
    s.dispatch({ type: "repairs/passGate", index: 0 })
    s.scheduler.runUntilIdle()
    const atMaintainers = snap(s).repairs
    for (const index of [0, 3, 6]) s.dispatch({ type: "repairs/passGate", index })
    expect(snap(s).repairs).toBe(atMaintainers)
  })

  it("an accept from the Agent view moves the rail the same way", () => {
    const s = setup()
    toReady(s)
    s.dispatch({ type: "core/proposalAccepted", id: proposalIdOf(1) })
    expect(run(s)).toMatchObject({ phase: "approved", passed: 1 })
  })
})

describe("repairs slice: the bad fix stops in the sandbox", () => {
  it("from ready: the tested fix is set aside, the bad one fails a check and nothing leaves the sandbox", () => {
    const s = setup()
    toReady(s)
    s.dispatch({ type: "repairs/badFix" })
    expect(proposal(s, proposalIdOf(1))?.decision?.decision).toBe("dismissed")
    expect(run(s)).toMatchObject({ fix: "bad", phase: "building", proposalId: null })
    s.scheduler.runUntilIdle()
    expect(run(s)).toMatchObject({ phase: "rejected", passed: 0, proposalId: null })
    expect(causes(s)).toContain("sandbox-rejected")
    expect(snap(s).core.proposals.filter((p) => p.decision === null)).toEqual([])
    expect(stateOf(s, "messaging")).toBe("error")
    expect(canPassGate(run(s), 0)).toBe(false)
    expect(repairSteps(s)).toEqual([])
    const log = snap(s).repairs.log.map((l) => l.text)
    expect(log).toContain(REPAIRS_COPY.log.rejected)
    expect(log).toContain(REPAIRS_COPY.log.failed(REPAIRS_COPY.checks.others.failName, REPAIRS_COPY.faults.outbox.badFix.failNote))
    expect(reasonOf(s, "repairs")).toBe(REPAIRS_COPY.reasons.rejected("message store"))
    // Approving is refused, and the rail never moves.
    s.dispatch({ type: "repairs/passGate", index: 0 })
    expect(run(s).phase).toBe("rejected")
  })

  it("while diagnosing: the cause is found first, then the bad fix is built", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate" })
    s.dispatch({ type: "repairs/badFix" })
    expect(run(s)).toMatchObject({ fix: "bad", phase: "diagnosing" })
    s.scheduler.runUntilIdle()
    expect(run(s).phase).toBe("rejected")
    expect(causes(s)).toContain("diagnosed")
    expect(snap(s).core.proposals).toEqual([])
  })

  it("a proper fix after the rejection passes and writes a new proposal", () => {
    const s = setup()
    toReady(s)
    s.dispatch({ type: "repairs/badFix" })
    s.scheduler.runUntilIdle()
    s.dispatch({ type: "repairs/properFix" })
    expect(run(s)).toMatchObject({ fix: "good", phase: "building" })
    s.scheduler.runUntilIdle()
    expect(run(s)).toMatchObject({ phase: "ready", proposalId: proposalIdOf(2) })
    expect(proposal(s, proposalIdOf(2))?.decision).toBeNull()
  })

  it("the bad fix cannot be asked for twice, nor after approval", () => {
    const s = setup()
    toReady(s)
    s.dispatch({ type: "repairs/badFix" })
    const bad = snap(s).repairs
    s.dispatch({ type: "repairs/badFix" })
    expect(snap(s).repairs).toBe(bad)
    const t = setup()
    toMaintainers(t)
    const approved = snap(t).repairs
    t.dispatch({ type: "repairs/badFix" })
    expect(snap(t).repairs).toBe(approved)
  })
})

describe("repairs slice: dismiss leaves the service broken", () => {
  it("dismissing keeps the service in ERROR; the agent waits for a person to try again", () => {
    const s = setup()
    toReady(s)
    s.dispatch({ type: "core/proposalDismissed", id: proposalIdOf(1) })
    expect(run(s).phase).toBe("dismissed")
    expect(stateOf(s, "messaging")).toBe("error")
    expect(reasonOf(s, "repairs")).toBe(REPAIRS_COPY.reasons.dismissed("message store"))
    expect(simulateStatus(snap(s).repairs, snap(s).core)).toBe("busy")
    s.scheduler.advance(DAY)
    expect(run(s).phase).toBe("dismissed")
    s.dispatch({ type: "repairs/retry" })
    expect(run(s)).toMatchObject({ n: 2, fault: "outbox", phase: "diagnosing" })
    s.scheduler.runUntilIdle()
    expect(run(s)).toMatchObject({ phase: "ready", proposalId: proposalIdOf(2) })
  })

  it("a part mended some other way frees the agent", () => {
    const s = setup()
    toReady(s)
    s.dispatch({ type: "core/proposalDismissed", id: proposalIdOf(1) })
    s.dispatch({ type: "core/serviceTransition", id: "messaging", to: "live" })
    expect(simulateStatus(snap(s).repairs, snap(s).core)).toBe("ready")
    s.dispatch({ type: "repairs/retry" })
    expect(run(s).phase).toBe("dismissed")
  })
})

describe("repairs slice: rotation and refusals", () => {
  it("skips parts that are already down, and says so when every part is down", () => {
    const s = setup()
    s.dispatch({ type: "core/serviceTransition", id: "messaging", to: "error" })
    expect(nextFaultId(snap(s).repairs, snap(s).core)).toBe("links")
    s.dispatch({ type: "core/serviceTransition", id: "mesh", to: "error" })
    expect(nextFaultId(snap(s).repairs, snap(s).core)).toBe("store")
    s.dispatch({ type: "core/serviceTransition", id: "storage", to: "error" })
    expect(nextFaultId(snap(s).repairs, snap(s).core)).toBeNull()
    expect(simulateStatus(snap(s).repairs, snap(s).core)).toBe("nothingLive")
    const before = snap(s).repairs
    s.dispatch({ type: "repairs/simulate" })
    expect(snap(s).repairs).toBe(before)
  })

  it("does nothing while the repairs service itself is not running", () => {
    const s = setup()
    s.dispatch({ type: "core/serviceTransition", id: "repairs", to: "error" })
    expect(simulateStatus(snap(s).repairs, snap(s).core)).toBe("notLive")
    s.dispatch({ type: "repairs/simulate" })
    expect(snap(s).repairs.run).toBeNull()
    expect(stateOf(s, "messaging")).toBe("live")
  })
})

describe("repairs slice: reduced motion", () => {
  it("each click lands on the next place a person decides, in the same dispatch", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate", instant: true })
    expect(run(s).phase).toBe("ready")
    expect(proposal(s, proposalIdOf(1))?.decision).toBeNull()
    expect(repairSteps(s)).toEqual([])
    s.dispatch({ type: "repairs/passGate", index: 0, instant: true })
    expect(run(s).passed).toBe(2)
    expect(stateOf(s, "messaging")).toBe("live")
    s.dispatch({ type: "repairs/passGate", index: 2, instant: true })
    expect(run(s).passed).toBe(6)
    s.dispatch({ type: "repairs/passGate", index: 6, instant: true })
    expect(run(s).passed).toBe(RAIL_LENGTH)
    expect(repairSteps(s)).toEqual([])
  })

  it("the bad fix lands rejected at once", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate", instant: true })
    s.dispatch({ type: "repairs/badFix", instant: true })
    expect(run(s).phase).toBe("rejected")
  })
})

describe("repairs slice: events and log", () => {
  it("every event of a full run carries a sentence, and the log follows HEAL_GATES", () => {
    const s = setup()
    toMaintainers(s)
    s.dispatch({ type: "repairs/passGate", index: 2 })
    s.scheduler.runUntilIdle()
    s.dispatch({ type: "repairs/passGate", index: 6 })
    for (const e of snap(s).core.events) expect(e.text.length).toBeGreaterThan(0)
    const log = snap(s).repairs.log.map((l) => l.text)
    for (const line of REPAIRS_COPY.log.stations) expect(log).toContain(line)
    expect(log.indexOf(REPAIRS_COPY.log.stations[0])).toBeLessThan(log.indexOf(REPAIRS_COPY.log.stations[6]))
    const seqs = snap(s).repairs.log.map((l) => l.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
  })

  it("the pure reducer is exported and ignores foreign actions", () => {
    const state = initialRepairs()
    const s = setup()
    const ctx = {
      world: DEMO_WORLD,
      now: 0,
      prev: snap(s),
      core: snap(s).core,
      schedule: () => {},
      cancel: () => {},
      dispatch: () => {},
      emit: () => {},
      rng: () => () => 0,
    }
    expect(reduceRepairs(state, { type: "core/toggleRail" }, ctx)).toBe(state)
  })
})
