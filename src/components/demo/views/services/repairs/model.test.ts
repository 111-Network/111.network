// Pure helpers of the Repairs page, plus the honesty rules of its copy (plan §5 L9, §6.4, §6.8, W1).
import { describe, expect, it } from "vitest"
import { HEAL_GATES } from "@/lib/heal"
import { REPAIRS_COPY } from "../../../copy/repairs"
import { createDemoStore, type DemoStore } from "../../../engine/store"
import type { DemoState } from "../../../engine/slices"
import { REPAIRS_TIMING as T, type RepairRun } from "../../../engine/slices/repairs"
import { DEMO_WORLD } from "../../../engine/world"
import {
  checkStates,
  checkText,
  joinNames,
  logLines,
  matrixRows,
  matrixSummary,
  railKey,
  runBadge,
  runDiff,
  runKey,
  sharedEntry,
  simulateHint,
  stationLine,
  stationState,
  stepStates,
  workingLine,
} from "./model"

const setup = (): DemoStore => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/services/repairs" })
const snap = (s: DemoStore): DemoState => s.getSnapshot()
const rows = (s: DemoStore) => matrixRows(snap(s).core.services, DEMO_WORLD, snap(s).repairs.repaired)

const base: RepairRun = { n: 1, fault: "outbox", target: "messaging", fix: "good", phase: "diagnosing", proposalId: null, passed: 0, startedAt: 0, instant: false }
const at = (patch: Partial<RepairRun>): RepairRun => ({ ...base, ...patch })
const stations = (run: RepairRun | null) => HEAL_GATES.map((_, i) => stationState(run, i))

describe("health matrix", () => {
  it("lists every layer the laptop runs, each with its watched parts", () => {
    const r = rows(setup())
    expect(r.map((x) => x.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (const row of r) expect(row.parts.length).toBeGreaterThan(0)
    expect(r[6].parts.map((p) => p.key)).toEqual(["mesh", "radio", "bridge"])
    // Layers without a service of their own are watched as part of the node.
    expect(r[1].parts).toEqual([{ key: "node-1", name: "Updater", state: "live", href: null, repaired: null }])
    expect(r[4].parts[0].name).toBe("This dashboard")
    expect(r[5].parts[0]).toMatchObject({ key: "messaging", state: "live", href: "/services/messaging" })
    expect(r[9].title).toBe("Repairs · L9")
  })

  it("the summary names what is broken, and NOT SET is not broken", () => {
    const s = setup()
    expect(matrixSummary(rows(s))).toBe(REPAIRS_COPY.matrix.allWell)
    s.dispatch({ type: "repairs/simulate" })
    expect(rows(s)[5].parts[0].state).toBe("error")
    expect(matrixSummary(rows(s))).toBe("Messaging needs a repair.")
    s.dispatch({ type: "core/serviceTransition", id: "storage", to: "error" })
    expect(matrixSummary(rows(s))).toBe("Messaging and Storage need a repair.")
  })

  it("marks a part repaired on this node with the virtual clock", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate", instant: true })
    s.dispatch({ type: "repairs/passGate", index: 0, instant: true })
    expect(rows(s)[5].parts[0].repaired).toMatch(/^repaired at \d\d:\d\d$/)
    expect(rows(s)[6].parts[0].repaired).toBeNull()
  })

  it("joins names in plain words", () => {
    expect(joinNames([])).toBe("")
    expect(joinNames(["A"])).toBe("A")
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C")
  })
})

describe("the run", () => {
  it("steps: one working at a time, all done once tested", () => {
    expect(stepStates(null)).toEqual(["waiting", "waiting", "waiting"])
    expect(stepStates(at({ phase: "diagnosing" }))).toEqual(["working", "waiting", "waiting"])
    expect(stepStates(at({ phase: "building" }))).toEqual(["done", "working", "waiting"])
    expect(stepStates(at({ phase: "testing" }))).toEqual(["done", "done", "working"])
    for (const phase of ["ready", "rejected", "dismissed", "approved"] as const) expect(stepStates(at({ phase }))).toEqual(["done", "done", "done"])
    expect(workingLine(at({ phase: "building", fix: "bad" }))).toBe(REPAIRS_COPY.run.workingBad[1])
    expect(workingLine(at({ phase: "ready" }))).toBeNull()
  })

  it("checks wait until the test ends; the bad fix fails its fault's check", () => {
    expect(checkStates(at({ phase: "testing" }))).toEqual({ sandbox: "waiting", replay: "waiting", others: "waiting" })
    expect(checkStates(at({ phase: "ready" }))).toEqual({ sandbox: "pass", replay: "pass", others: "pass" })
    expect(checkStates(at({ phase: "rejected", fix: "bad" }))).toEqual({ sandbox: "pass", replay: "pass", others: "fail" })
    expect(checkStates(at({ phase: "rejected", fix: "bad", fault: "links", target: "mesh" }))).toEqual({ sandbox: "pass", replay: "fail", others: "pass" })
    expect(checkText(at({ phase: "ready" }), "replay", "pass")).toBe("failure replayed: gone")
    expect(checkText(at({ phase: "ready" }), "others", "pass")).toBe("other layers untouched")
    expect(checkText(at({ phase: "rejected", fix: "bad" }), "others", "fail")).toBe(`other layers: ${REPAIRS_COPY.faults.outbox.badFix.failNote}`)
  })

  it("the change appears once the cause is found, and follows the fix", () => {
    expect(runDiff(null)).toBeNull()
    expect(runDiff(at({ phase: "diagnosing" }))).toBeNull()
    expect(runDiff(at({ phase: "building" }))).toBe(REPAIRS_COPY.faults.outbox.fix.diff)
    expect(runDiff(at({ phase: "building", fix: "bad" }))).toBe(REPAIRS_COPY.faults.outbox.badFix.diff)
  })

  it("the badge follows the pull request down the rail", () => {
    expect(runBadge(at({ phase: "testing" }))).toBe("working")
    expect(runBadge(at({ phase: "ready" }))).toBe("ready")
    expect(runBadge(at({ phase: "rejected" }))).toBe("rejected")
    expect(runBadge(at({ phase: "dismissed" }))).toBe("dismissed")
    expect([1, 2, 3, 4, 7].map((passed) => runBadge(at({ phase: "approved", passed })))).toEqual(["approved", "upstream", "reviewed", "merged", "merged"])
  })

  it("focus keys change whenever the controls can change", () => {
    expect(runKey(null)).toBe("none")
    expect(runKey(at({ phase: "ready" }))).not.toBe(runKey(at({ phase: "ready", fix: "bad" })))
    expect(railKey(at({ phase: "approved", passed: 2 }))).not.toBe(railKey(at({ phase: "approved", passed: 3 })))
  })
})

describe("gate rail stations", () => {
  it("nothing is reached before the checks pass, or after a rejection or a dismissal", () => {
    for (const run of [null, at({ phase: "testing" }), at({ phase: "rejected", fix: "bad" }), at({ phase: "dismissed" })]) {
      expect(stations(run).every((x) => x === "idle")).toBe(true)
    }
  })

  it("the first human gate waits once the checks pass", () => {
    expect(stations(at({ phase: "ready" }))).toEqual(["waiting", "idle", "idle", "idle", "idle", "idle", "idle"])
    expect(stationLine(HEAL_GATES[0], "waiting")).toBe(REPAIRS_COPY.rail.state.waitingYou)
  })

  it("machine stations are arriving while human and upstream ones wait for a person", () => {
    expect(stations(at({ phase: "approved", passed: 1 }))).toEqual(["passed", "arriving", "idle", "idle", "idle", "idle", "idle"])
    expect(stations(at({ phase: "approved", passed: 2 }))[2]).toBe("waiting")
    expect(stationLine(HEAL_GATES[2], "waiting")).toBe(REPAIRS_COPY.rail.state.waitingMaintainers)
    expect(stations(at({ phase: "approved", passed: 6 }))[6]).toBe("waiting")
    expect(stationLine(HEAL_GATES[6], "waiting")).toBe(REPAIRS_COPY.rail.state.waitingOwner)
    expect(stations(at({ phase: "approved", passed: 7 })).every((x) => x === "passed")).toBe(true)
  })

  it("the rail's stations are the W13 order", () => {
    expect(HEAL_GATES.map((g) => g.label)).toEqual(["APPROVED HERE", "PR UPSTREAM", "MAINTAINERS", "MERGED", "VIA GATEWAY", "NODE B RE-CHECKS", "NODE B'S OWNER"])
  })
})

describe("logs and hints", () => {
  it("log lines read time, who, what", () => {
    const s = setup()
    s.dispatch({ type: "repairs/simulate" })
    s.scheduler.advance(T.diagnoseMs)
    const lines = logLines(snap(s).repairs.log)
    expect(lines[0]).toBe(`09:00 agent: ${REPAIRS_COPY.log.noticed("messaging", REPAIRS_COPY.faults.outbox.symptom)}`)
    expect(lines[1]).toMatch(/^09:00 agent: diagnosis: /)
  })

  it("the simulate hint says why it waits", () => {
    expect(simulateHint("ready", "messaging")).toBe(REPAIRS_COPY.simulateHint.ready("messaging"))
    expect(simulateHint("busy", null)).toBe(REPAIRS_COPY.simulateHint.busy)
    expect(simulateHint("working", null)).toBe(REPAIRS_COPY.simulateHint.busy)
    expect(simulateHint("notLive", null)).toBe(REPAIRS_COPY.simulateHint.notLive)
    expect(simulateHint("nothingLive", null)).toBe(REPAIRS_COPY.simulateHint.nothingLive)
  })

  it("a shared fix reads its title and where it went", () => {
    const e = sharedEntry({ id: "repairs-fix-1", fault: "store", at: 0 })
    expect(e).toEqual({ title: REPAIRS_COPY.faults.store.title, line: REPAIRS_COPY.shared.entry("storage"), at: "09:00" })
  })
})

describe("copy honesty (plan §5 L9: no code, no numbers in a fix)", () => {
  const fixes = Object.values(REPAIRS_COPY.faults).flatMap((f) => [f.fix, f.badFix])
  it("every diff line and summary is plain words: no digits, no code characters", () => {
    for (const fix of fixes) {
      for (const text of [fix.summary, ...fix.diff.map((l) => l.text)]) expect(text).not.toMatch(/[0-9{}()[\];=<>_`$/\\]/)
    }
  })

  it("every good fix adds something and the diff marks each line as added, removed or kept", () => {
    for (const f of Object.values(REPAIRS_COPY.faults)) {
      expect(f.fix.diff.some((l) => l.op === "add")).toBe(true)
      for (const l of [...f.fix.diff, ...f.badFix.diff]) expect(["add", "remove", "keep"]).toContain(l.op)
    }
  })

  it("the bad fix's rejection says nothing leaves the sandbox", () => {
    expect(REPAIRS_COPY.rejected).toBe("fix rejected: nothing leaves the sandbox")
    expect(REPAIRS_COPY.checks.sandbox.pass).toBe("applied in a sandbox")
    expect(REPAIRS_COPY.checks.replay.pass).toBe("failure replayed: gone")
    expect(REPAIRS_COPY.checks.others.pass).toBe("other layers untouched")
  })

  it("the rail copy promises no auto-continue", () => {
    expect(REPAIRS_COPY.rail.forever).toMatch(/as long as it takes/)
    expect(REPAIRS_COPY.log.stations).toHaveLength(HEAL_GATES.length)
  })
})
