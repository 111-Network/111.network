import { describe, expect, it } from "vitest"
import { DEVICE_IDS, type DeviceId } from "@/lib/devices"
import { HEAL_GATES, waitsForVisitor } from "@/lib/heal"
import {
  AGENT_STEP_COUNT,
  BOARD_LAYERS,
  FAULTS,
  INITIAL_HEAL_STATE,
  LEFT_BROKEN_NOTE,
  RAIL_LENGTH,
  REJECTED_LINE,
  RELAY_GATE_HINT,
  RELAY_LINES,
  RELAY_NARRATION,
  agentLog,
  boardHealth,
  boardRows,
  canBreak,
  canDismiss,
  canPassGate,
  canTryBadFix,
  canTryGoodFix,
  changesPendingLine,
  checkRows,
  checksPassed,
  faultById,
  fixRejected,
  hasPendingWork,
  healMode,
  healPhase,
  healReducer,
  logVerdict,
  narrate,
  prBadge,
  settle,
  stationState,
  talkLog,
  tick,
  type FaultId,
  type HealAction,
  type HealState,
} from "./model"

function run(state: HealState, ...actions: HealAction[]): HealState {
  return actions.reduce(healReducer, state)
}

function ticks(state: HealState, n: number): HealState {
  let next = state
  for (let i = 0; i < n; i++) next = healReducer(next, { type: "tick" })
  return next
}

/** A BREAK A LAYER click on the laptop (the default device). */
const breakIt = (fault: FaultId, instant?: boolean): HealAction => ({ type: "break", fault, device: "laptop", instant })
const broken = (fault: FaultId = "outbox") => run(INITIAL_HEAL_STATE, breakIt(fault))
/** A fault whose real fix passed every check: waiting at APPROVE ON THIS NODE. */
const ready = (fault: FaultId = "outbox") => settle(broken(fault))
const MAINTAINERS = HEAL_GATES.findIndex((g) => g.id === "maintainers")
const NODE_B_OWNER = HEAL_GATES.findIndex((g) => g.id === "node-b-owner")

describe("faults", () => {
  it("offers three canned faults on layers 5, 7 and 8", () => {
    expect(FAULTS).toHaveLength(3)
    expect(FAULTS.map((f) => f.layer)).toEqual([5, 7, 8])
    for (const f of FAULTS) expect(faultById(f.id)).toBe(f)
  })

  it("only breaks layers every self-healing device runs", () => {
    for (const device of DEVICE_IDS) {
      for (const f of FAULTS) expect(canBreak(device, f.id)).toBe(healMode(device) !== "none")
    }
  })

  it("describes faults every device has: no radio, no sleep, and presence stays continuous", () => {
    for (const f of FAULTS) {
      const copy = [f.symptom, f.diagnosis, f.title, f.fix.summary, f.badFix.summary, f.badFix.failNote]
      const diff = [...f.fix.diff, ...f.badFix.diff]
      for (const line of [...copy, ...diff.map((d) => d.text)]) expect(line).not.toMatch(/radio|sleep|wake/i)
      // No fix keeps or adds a pause in announcing (L7: continuous heartbeats).
      for (const d of diff) if (d.op !== "remove") expect(d.text).not.toMatch(/pause/i)
    }
  })

  it("keeps the diff in plain words: no numbers, no code, no glyphs the font lacks", () => {
    const lines = FAULTS.flatMap((f) => [
      f.button,
      f.symptom,
      f.diagnosis,
      f.title,
      f.fix.summary,
      f.badFix.summary,
      f.badFix.failNote,
      ...f.fix.diff.map((d) => d.text),
      ...f.badFix.diff.map((d) => d.text),
    ])
    for (const line of lines) {
      expect(line).not.toMatch(/\d/)
      expect(line).not.toMatch(/[{}<>;=()[\]]/)
      expect(line).not.toMatch(/[■□▪▫▸◂◐◑✓✗★☐☑]/)
    }
  })

  it("gives every fix both an addition and something it replaces or keeps", () => {
    for (const f of FAULTS) {
      expect(f.fix.diff.some((d) => d.op === "add")).toBe(true)
      expect(f.badFix.diff.some((d) => d.op === "add")).toBe(true)
    }
  })
})

describe("health board", () => {
  it("starts healthy, and shows the layers a device does not run as not run", () => {
    const rows = boardRows(INITIAL_HEAL_STATE, "laptop")
    expect(rows.map((r) => r.n)).toEqual([...BOARD_LAYERS])
    expect(rows.map((r) => r.health)).toEqual(["live", "not-run", "live", "live"])
    expect(rows[1].note).toBe("not run on this device")
  })

  it("follows the README table per device", () => {
    expect(boardRows(INITIAL_HEAL_STATE, "radio-relay").map((r) => r.health)).toEqual([
      "live",
      "not-run",
      "live",
      "not-run",
    ])
    expect(boardRows(INITIAL_HEAL_STATE, "radio-box").map((r) => r.health)).toEqual(["live", "live", "live", "live"])
    expect(boardRows(INITIAL_HEAL_STATE, "old-phone")[3].note).toBe("partly, or via a nearby node")
  })

  it("says a radio relay forwards messages without reading them, not that a nearby node runs them", () => {
    const messaging = boardRows(INITIAL_HEAL_STATE, "radio-relay")[0]
    expect(messaging.n).toBe(5)
    expect(messaging.note).toBe("forwards sealed messages without reading them")
    expect(messaging.note).not.toMatch(/nearby node/)
    // Other devices keep the generic wording.
    expect(boardRows(INITIAL_HEAL_STATE, "old-phone")[0].note).toBeNull()
  })

  it("turns the broken layer red until the fix is applied on this node", () => {
    expect(boardHealth(broken("heartbeat"), "laptop", 7)).toBe("error")
    expect(boardHealth(broken("heartbeat"), "laptop", 5)).toBe("live")
    const approved = run(ready("heartbeat"), { type: "pass-gate", index: 0 })
    expect(boardHealth(ready("heartbeat"), "laptop", 7)).toBe("error")
    expect(boardHealth(approved, "laptop", 7)).toBe("fixed")
  })
})

describe("agent steps", () => {
  it("diagnoses, builds a fix and tests it in a sandbox, one tick per step", () => {
    let state = broken()
    expect(state.agentStep).toBe(0)
    expect(healPhase(state)).toBe("working")
    expect(agentLog(state, "laptop").every((s) => s.text === null)).toBe(true)
    for (let step = 1; step <= AGENT_STEP_COUNT; step++) {
      state = tick(state)
      const log = agentLog(state, "laptop")
      expect(log.filter((s) => s.text !== null)).toHaveLength(step)
    }
    expect(agentLog(state, "laptop").map((s) => s.label)).toEqual(["diagnose", "build a fix", "test in a sandbox"])
    expect(healPhase(state)).toBe("ready")
  })

  it("prints each step whole, the sandbox step as the checks strip", () => {
    const log = agentLog(ready(), "laptop")
    expect(log[0].text).toBe(faultById("outbox").diagnosis)
    expect(log[1].text).toBe(faultById("outbox").fix.summary)
    expect(log[2].text).toBe("applied in a sandbox · failure replayed: gone · other layers untouched")
  })

  it("reads 'asked a nearby hub' at the build step on an old phone and the small box with a radio", () => {
    for (const device of ["old-phone", "radio-box"] as const) {
      expect(healMode(device)).toBe("via-hub")
      expect(agentLog(ready(), device)[1].text).toMatch(/^asked a nearby hub/)
      expect(talkLog(ready(), device).some((e) => e.text.startsWith("asked a nearby hub"))).toBe(true)
    }
    for (const device of ["laptop", "home-server", "gpu-pc"] as const) {
      expect(healMode(device)).toBe("native")
      expect(agentLog(ready(), device)[1].text).not.toMatch(/nearby hub/)
    }
  })

  it("closes the log only once the run has an outcome", () => {
    expect(logVerdict(INITIAL_HEAL_STATE)).toBeNull()
    expect(logVerdict(ticks(broken(), 2))).toBeNull()
    expect(logVerdict(ready())).toMatch(/approve it on this node/)
    expect(logVerdict(settle(run(broken(), { type: "bad-fix" })))).toBe(REJECTED_LINE)
    expect(logVerdict(run(broken(), { type: "dismiss" }))).toMatch(/stays broken/)
    expect(logVerdict(run(ready(), { type: "pass-gate", index: 0 }))).toMatch(/live again/)
  })

  it("keeps the checks waiting until the sandbox test has run", () => {
    expect(checkRows(ticks(broken(), 2)).map((c) => c.result)).toEqual(["waiting", "waiting", "waiting"])
    expect(checkRows(ready()).map((c) => c.result)).toEqual(["pass", "pass", "pass"])
    expect(checkRows(ready()).map((c) => c.label)).toEqual([
      "applied in a sandbox",
      "failure replayed: gone",
      "other layers untouched",
    ])
  })
})

describe("checks gate APPROVE ON THIS NODE", () => {
  it("is enabled only after the checks pass", () => {
    let state = broken()
    for (let i = 0; i < AGENT_STEP_COUNT; i++) {
      expect(canPassGate(state, 0)).toBe(false)
      expect(run(state, { type: "pass-gate", index: 0 })).toEqual(state)
      state = tick(state)
    }
    expect(checksPassed(state)).toBe(true)
    expect(canPassGate(state, 0)).toBe(true)
    expect(run(state, { type: "pass-gate", index: 0 }).passed).toBe(1)
  })

  it("cannot be passed with nothing broken", () => {
    expect(canPassGate(INITIAL_HEAL_STATE, 0)).toBe(false)
    expect(run(INITIAL_HEAL_STATE, { type: "pass-gate", index: 0 })).toEqual(INITIAL_HEAL_STATE)
  })
})

describe("gate rail (W13)", () => {
  it("never auto-continues past a human or upstream station", () => {
    const atApprove = ready()
    expect(hasPendingWork(atApprove)).toBe(false)
    expect(ticks(atApprove, 10)).toEqual(atApprove)
    expect(settle(atApprove)).toEqual(atApprove)
  })

  it("fills machine stations by itself and stops at the maintainers", () => {
    const approved = run(ready(), { type: "pass-gate", index: 0 })
    expect(approved.passed).toBe(1)
    expect(stationState(approved, 0)).toBe("passed")
    expect(hasPendingWork(approved)).toBe(true)
    const atMaintainers = settle(approved)
    expect(atMaintainers.passed).toBe(MAINTAINERS)
    expect(waitsForVisitor(atMaintainers.passed)).toBe(true)
    expect(stationState(atMaintainers, MAINTAINERS)).toBe("waiting")
    expect(ticks(atMaintainers, 10)).toEqual(atMaintainers)
    expect(prBadge(atMaintainers)).toBe("OPEN UPSTREAM")
  })

  it("advances MAINTAINERS → MERGED only with next, then stops at node B's owner", () => {
    const atMaintainers = settle(run(ready(), { type: "pass-gate", index: 0 }))
    const merged = run(atMaintainers, { type: "pass-gate", index: MAINTAINERS })
    expect(merged.passed).toBe(MAINTAINERS + 1)
    const atOwnerB = settle(merged)
    expect(atOwnerB.passed).toBe(NODE_B_OWNER)
    expect(stationState(atOwnerB, NODE_B_OWNER)).toBe("waiting")
    expect(ticks(atOwnerB, 10)).toEqual(atOwnerB)
    expect(prBadge(atOwnerB)).toBe("MERGED")
    const done = run(atOwnerB, { type: "pass-gate", index: NODE_B_OWNER })
    expect(done.passed).toBe(RAIL_LENGTH)
    expect(healPhase(done)).toBe("done")
    expect(HEAL_GATES.map((_, i) => stationState(done, i)).every((s) => s === "passed")).toBe(true)
  })

  it("lets a click pass only the station the fix waits at, and never a machine station", () => {
    const atMaintainers = settle(run(ready(), { type: "pass-gate", index: 0 }))
    expect(run(atMaintainers, { type: "pass-gate", index: NODE_B_OWNER })).toEqual(atMaintainers)
    expect(run(atMaintainers, { type: "pass-gate", index: 0 })).toEqual(atMaintainers)
    const approved = run(ready(), { type: "pass-gate", index: 0 })
    expect(run(approved, { type: "pass-gate", index: 1 })).toEqual(approved)
  })

  it("keeps the human stations unpassed until their button is clicked", () => {
    for (const state of [INITIAL_HEAL_STATE, broken(), ready()]) {
      expect(stationState(state, 0)).not.toBe("passed")
      expect(stationState(state, NODE_B_OWNER)).not.toBe("passed")
    }
    expect(stationState(settle(run(ready(), { type: "pass-gate", index: 0 })), NODE_B_OWNER)).toBe("idle")
  })

  it("logs every passed station in TALK, in order", () => {
    const atOwnerB = settle(run(settle(run(ready(), { type: "pass-gate", index: 0 })), { type: "pass-gate", index: MAINTAINERS }))
    const done = run(atOwnerB, { type: "pass-gate", index: NODE_B_OWNER })
    const who = talkLog(done, "laptop").map((e) => e.who)
    expect(who.slice(-RAIL_LENGTH)).toEqual([
      "you",
      "agent",
      "maintainers",
      "maintainers",
      "gateway",
      "node B's agent",
      "node B's owner",
    ])
  })
})

describe("TRY A BAD FIX", () => {
  it("stops at the sandbox: nothing leaves it and the dot stays red", () => {
    const bad = settle(run(broken(), { type: "bad-fix" }))
    expect(fixRejected(bad)).toBe(true)
    expect(healPhase(bad)).toBe("rejected")
    expect(checksPassed(bad)).toBe(false)
    expect(canPassGate(bad, 0)).toBe(false)
    expect(run(bad, { type: "pass-gate", index: 0 })).toEqual(bad)
    expect(boardHealth(bad, "laptop", 5)).toBe("error")
    expect(HEAL_GATES.map((_, i) => stationState(bad, i)).every((s) => s === "idle")).toBe(true)
    expect(talkLog(bad, "laptop").at(-1)?.text).toBe(REJECTED_LINE)
    expect(REJECTED_LINE).toBe("fix rejected: nothing leaves the sandbox")
    expect(narrate(bad, "laptop")).toMatch(/^Fix rejected: nothing leaves the sandbox/)
  })

  it("fails the check each bad fix is caught by", () => {
    for (const f of FAULTS) {
      const rows = checkRows(settle(run(broken(f.id), { type: "bad-fix" })))
      expect(rows.find((c) => c.id === "sandbox")?.result).toBe("pass")
      expect(rows.filter((c) => c.result === "fail").map((c) => c.id)).toEqual([f.badFix.fails])
    }
    const heartbeat = checkRows(settle(run(broken("heartbeat"), { type: "bad-fix" })))
    expect(heartbeat.find((c) => c.id === "replay")?.label).toBe(
      `failure replayed: ${faultById("heartbeat").badFix.failNote}`,
    )
    const store = checkRows(settle(run(broken("store"), { type: "bad-fix" })))
    expect(store.find((c) => c.id === "others")?.label).toBe(`other layers: ${faultById("store").badFix.failNote}`)
  })

  it("shows every bad fix's failNote on the check that fails", () => {
    for (const f of FAULTS) {
      const failed = checkRows(settle(run(broken(f.id), { type: "bad-fix" }))).find((c) => c.result === "fail")
      expect(failed?.label.endsWith(f.badFix.failNote)).toBe(true)
    }
  })

  it("can be asked for before the diagnosis: the agent diagnoses first, then the sandbox rejects it", () => {
    const early = run(broken(), { type: "bad-fix" })
    expect(early.agentStep).toBe(0)
    expect(early.fix).toBe("bad")
    expect(healPhase(early)).toBe("working")
    expect(agentLog(tick(early), "laptop")[0].text).toBe(faultById("outbox").diagnosis)
    const done = ticks(early, AGENT_STEP_COUNT)
    expect(fixRejected(done)).toBe(true)
    expect(canPassGate(done, 0)).toBe(false)
    expect(boardHealth(done, "laptop", 5)).toBe("error")
  })

  it("narrates the swap itself, not a repeat of the diagnosis", () => {
    const diagnosed = tick(broken())
    expect(narrate(diagnosed, "laptop")).toMatch(/^Diagnosis:/)
    const bad = run(diagnosed, { type: "bad-fix" })
    expect(bad.agentStep).toBe(1)
    expect(narrate(bad, "laptop")).toBe("The agent is building the bad fix you asked for and will test it in a sandbox.")
    expect(narrate(bad, "old-phone")).toMatch(/nearby hub to build the bad fix you asked for/)
    const good = run(settle(bad), { type: "good-fix" })
    expect(good.agentStep).toBe(1)
    expect(narrate(good, "laptop")).toBe("The agent is building a good fix instead and will test it in a sandbox.")
    expect(narrate(run(broken(), { type: "bad-fix" }), "laptop")).toMatch(/then builds the bad fix you asked for\.$/)
    expect(narrate(tick(bad), "laptop")).toMatch(/built the bad fix/)
  })

  it("never says the agent is still diagnosing once the diagnosis is printed", () => {
    expect(changesPendingLine(broken(), "laptop")).toBe("No changes yet: the agent is still diagnosing.")
    const diagnosed = tick(broken())
    expect(changesPendingLine(diagnosed, "laptop")).toBe("No changes yet: the agent is building a fix.")
    expect(changesPendingLine(run(diagnosed, { type: "bad-fix" }), "laptop")).toBe(
      "No changes yet: the agent is building the bad fix.",
    )
    expect(changesPendingLine(diagnosed, "radio-box")).toBe("No changes yet: a nearby hub is building a fix.")
  })

  it("keeps the diagnosis and rebuilds, and BUILD A GOOD FIX recovers", () => {
    const bad = run(ready(), { type: "bad-fix" })
    expect(bad.agentStep).toBe(1)
    expect(agentLog(bad, "laptop")[0].text).not.toBeNull()
    expect(canTryBadFix(bad)).toBe(false)
    expect(canTryGoodFix(bad)).toBe(true)
    const good = settle(run(settle(bad), { type: "good-fix" }))
    expect(checksPassed(good)).toBe(true)
  })

  it("is not offered once the fix is applied on this node", () => {
    const approved = run(ready(), { type: "pass-gate", index: 0 })
    expect(canTryBadFix(approved)).toBe(false)
    expect(run(approved, { type: "bad-fix" })).toEqual(approved)
  })
})

describe("DISMISS", () => {
  it("leaves the dot red, stops the agent and blocks every gate", () => {
    const midway = tick(broken())
    const dismissed = run(midway, { type: "dismiss" })
    expect(healPhase(dismissed)).toBe("dismissed")
    expect(boardHealth(dismissed, "laptop", 5)).toBe("error")
    expect(hasPendingWork(dismissed)).toBe(false)
    expect(ticks(dismissed, 10)).toEqual(dismissed)
    const fromReady = run(ready(), { type: "dismiss" })
    expect(canPassGate(fromReady, 0)).toBe(false)
    expect(boardHealth(fromReady, "laptop", 5)).toBe("error")
    expect(narrate(fromReady, "laptop")).toMatch(/stays broken/)
  })

  it("is not offered once the fix is applied on this node", () => {
    const approved = run(ready(), { type: "pass-gate", index: 0 })
    expect(canDismiss(approved)).toBe(false)
    expect(run(approved, { type: "dismiss" })).toEqual(approved)
  })
})

describe("a layer left without a fix stays red", () => {
  it("break → dismiss → break another leaves the first layer red", () => {
    const dismissed = run(broken("outbox"), { type: "dismiss" })
    const next = run(dismissed, breakIt("heartbeat"))
    expect(next.fault).toBe("heartbeat")
    expect(next.unresolved).toEqual(["outbox"])
    expect(boardHealth(next, "laptop", 5)).toBe("error")
    expect(boardHealth(next, "laptop", 7)).toBe("error")
    expect(boardRows(next, "laptop")[0].leftBroken).toBe(true)
    expect(narrate(next, "laptop")).toMatch(/Messaging stays broken: nothing was applied there\.$/)
    // Fixing the second one heals only the second one.
    const fixed = run(ready("heartbeat"), { type: "pass-gate", index: 0 })
    const fixedNext = run(settle(next), { type: "pass-gate", index: 0 })
    expect(boardHealth(fixed, "laptop", 7)).toBe("fixed")
    expect(boardHealth(fixedNext, "laptop", 7)).toBe("fixed")
    expect(boardHealth(fixedNext, "laptop", 5)).toBe("error")
    expect(narrate(fixedNext, "laptop")).toMatch(/Messaging stays broken/)
  })

  it("a rejected bad fix or an abandoned run also stays red", () => {
    const rejected = settle(run(broken("store"), { type: "bad-fix" }))
    expect(boardHealth(run(rejected, breakIt("outbox")), "laptop", 8)).toBe("error")
    const midway = tick(broken("store"))
    expect(boardHealth(run(midway, breakIt("outbox")), "laptop", 8)).toBe("error")
    const both = run(rejected, breakIt("outbox"), breakIt("heartbeat"))
    expect(both.unresolved).toEqual(["outbox", "store"])
    expect(narrate(both, "laptop")).toMatch(/Messaging and storage stay broken/)
  })

  it("a fix applied on this node stays fixed when another layer breaks", () => {
    const applied = settle(run(ready("outbox"), { type: "pass-gate", index: 0 }))
    const next = run(applied, breakIt("store"))
    expect(next).toEqual({ ...INITIAL_HEAL_STATE, fault: "store" })
    expect(boardHealth(next, "laptop", 5)).toBe("live")
    expect(boardHealth(next, "laptop", 8)).toBe("error")
  })

  it("breaking a left-broken layer again puts it back on the bench", () => {
    const next = run(broken("outbox"), { type: "dismiss" }, breakIt("store"), breakIt("outbox"))
    expect(next.fault).toBe("outbox")
    expect(next.unresolved).toEqual(["store"])
    expect(settle(next).agentStep).toBe(AGENT_STEP_COUNT)
    expect(checksPassed(settle(next))).toBe(true)
  })

  it("re-breaking the fault on the bench restarts its run without leaving it behind", () => {
    const again = run(tick(broken("outbox")), breakIt("outbox"))
    expect(again).toEqual(broken("outbox"))
  })

  it("only RESET clears every red layer", () => {
    const messy = run(broken("outbox"), { type: "dismiss" }, breakIt("store"))
    expect(run(messy, { type: "reset" })).toEqual(INITIAL_HEAL_STATE)
    expect(boardRows(run(messy, { type: "reset" }), "laptop").every((r) => !r.leftBroken)).toBe(true)
    expect(LEFT_BROKEN_NOTE).toMatch(/nothing was applied/)
  })

  it("a layer the device does not run is never shown as left broken", () => {
    // The radio relay never starts a run, so nothing can be left there.
    expect(boardRows(INITIAL_HEAL_STATE, "radio-relay").every((r) => !r.leftBroken)).toBe(true)
  })
})

describe("reduced motion (instant actions)", () => {
  it("resolves each click to the state a real node rests in", () => {
    const atApprove = run(INITIAL_HEAL_STATE, breakIt("store", true))
    expect(atApprove).toEqual(ready("store"))
    const atMaintainers = run(atApprove, { type: "pass-gate", index: 0, instant: true })
    expect(atMaintainers.passed).toBe(MAINTAINERS)
    const atOwnerB = run(atMaintainers, { type: "pass-gate", index: MAINTAINERS, instant: true })
    expect(atOwnerB.passed).toBe(NODE_B_OWNER)
    expect(run(atOwnerB, { type: "pass-gate", index: NODE_B_OWNER, instant: true }).passed).toBe(RAIL_LENGTH)
  })

  it("finishes half-done machine work before a click", () => {
    const half = tick(broken())
    expect(run(half, { type: "pass-gate", index: 0, instant: true }).passed).toBe(MAINTAINERS)
    expect(run(half, { type: "pass-gate", index: 0 })).toEqual(half)
  })

  it("never passes a human gate by itself", () => {
    expect(settle(ready()).passed).toBe(0)
    const bad = run(INITIAL_HEAL_STATE, breakIt("outbox", true), { type: "bad-fix", instant: true })
    expect(fixRejected(bad)).toBe(true)
    expect(bad.passed).toBe(0)
  })

  it("settles an instant DISMISS from a half-done run: the agent stops, the layer stays red", () => {
    const half = tick(broken())
    const dismissed = run(half, { type: "dismiss", instant: true })
    expect(healPhase(dismissed)).toBe("dismissed")
    expect(hasPendingWork(dismissed)).toBe(false)
    expect(boardHealth(dismissed, "laptop", 5)).toBe("error")
    expect(canPassGate(dismissed, 0)).toBe(false)
  })

  it("settles an instant fix swap from a half-done run to the sandbox's verdict", () => {
    const half = tick(broken("store"))
    const bad = run(half, { type: "bad-fix", instant: true })
    expect(fixRejected(bad)).toBe(true)
    const good = run(bad, { type: "good-fix", instant: true })
    expect(checksPassed(good)).toBe(true)
    expect(good.passed).toBe(0)
    expect(canPassGate(good, 0)).toBe(true)
  })
})

describe("break and reset", () => {
  it("reset puts every layer back to healthy", () => {
    expect(run(ready(), { type: "dismiss" }, { type: "reset" })).toEqual(INITIAL_HEAL_STATE)
  })
})

describe("devices", () => {
  it("has no bench on a radio relay and says why in plain words", () => {
    expect(healMode("radio-relay")).toBe("none")
    for (const f of FAULTS) expect(canBreak("radio-relay", f.id)).toBe(false)
    // The live line never repeats the agent log's two sentences word for word.
    expect(narrate(INITIAL_HEAL_STATE, "radio-relay")).toBe(RELAY_NARRATION)
    for (const line of RELAY_LINES) expect(RELAY_NARRATION).not.toContain(line)
    expect(RELAY_NARRATION).toMatch(/another device/)
    expect(RELAY_LINES.join(" ")).toMatch(/only forwards/)
    expect(RELAY_LINES.join(" ")).toMatch(/nearby node/)
    expect(RELAY_GATE_HINT).toMatch(/runs no agent/)
  })

  it("never starts a run on a radio relay, even if a break reaches the reducer", () => {
    for (const f of FAULTS) {
      for (const instant of [false, true]) {
        const state = run(INITIAL_HEAL_STATE, { type: "break", fault: f.id, device: "radio-relay", instant })
        expect(state).toEqual(INITIAL_HEAL_STATE)
        expect(hasPendingWork(state)).toBe(false)
      }
    }
  })

  it("starts a run on every device that runs an agent", () => {
    for (const device of DEVICE_IDS) {
      if (healMode(device) === "none") continue
      for (const f of FAULTS) expect(run(INITIAL_HEAL_STATE, { type: "break", fault: f.id, device }).fault).toBe(f.id)
    }
  })
})

/** Every state the bench can rest or pass through, across faults, swaps and left-broken layers. */
function sampleStates(): HealState[] {
  const states: HealState[] = [INITIAL_HEAL_STATE]
  for (const f of FAULTS) {
    const start = broken(f.id)
    states.push(start, tick(start), ticks(start, 2), ready(f.id))
    let rail = run(ready(f.id), { type: "pass-gate", index: 0 })
    states.push(rail)
    while (rail.passed < RAIL_LENGTH) {
      rail = hasPendingWork(rail) ? tick(rail) : run(rail, { type: "pass-gate", index: rail.passed })
      states.push(rail)
    }
    const bad = run(start, { type: "bad-fix" })
    states.push(bad, tick(bad), ticks(bad, 2), settle(bad))
    const good = run(settle(bad), { type: "good-fix" })
    states.push(good, tick(good), settle(good))
    states.push(run(start, { type: "dismiss" }), run(ready(f.id), { type: "dismiss" }))
  }
  const left = run(broken("outbox"), { type: "dismiss" }, breakIt("store"))
  states.push(left, settle(left), run(settle(left), { type: "pass-gate", index: 0 }))
  states.push(run(settle(run(broken("store"), { type: "bad-fix" })), breakIt("outbox"), breakIt("heartbeat")))
  return states
}

describe("copy in every state", () => {
  const GLYPHS = /[■□▪▫▸◂◐◑✓✗★☐☑]/

  it("narrates every phase for every device without digits", () => {
    for (const device of DEVICE_IDS as readonly DeviceId[]) {
      for (const state of sampleStates()) {
        const line = narrate(state, device)
        expect(line.length).toBeGreaterThan(0)
        expect(line).not.toMatch(/\d/)
        expect(line).not.toMatch(GLYPHS)
      }
    }
  })

  it("prints no digits or missing glyphs in TALK, the log, the badge, the checks or the board", () => {
    for (const device of DEVICE_IDS as readonly DeviceId[]) {
      for (const state of sampleStates()) {
        const lines = [
          ...talkLog(state, device).flatMap((e) => [e.who, e.text]),
          ...agentLog(state, device).flatMap((s) => [s.label, s.text ?? ""]),
          logVerdict(state) ?? "",
          prBadge(state),
          ...checkRows(state).map((c) => c.label),
          changesPendingLine(state, device),
          ...boardRows(state, device).flatMap((r) => [r.name, r.note ?? ""]),
        ]
        for (const line of lines) {
          expect(line).not.toMatch(/\d/)
          expect(line).not.toMatch(GLYPHS)
        }
      }
    }
    for (const line of [...RELAY_LINES, RELAY_NARRATION, RELAY_GATE_HINT, LEFT_BROKEN_NOTE]) {
      expect(line).not.toMatch(/\d/)
      expect(line).not.toMatch(GLYPHS)
    }
  })
})
