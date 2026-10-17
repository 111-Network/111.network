import { describe, expect, it } from "vitest"
import { DEVICE_IDS, deviceById, layerSupport, type DeviceId } from "@/lib/devices"
import {
  BORROWER_DEVICE,
  BRAIN_LINES,
  BRAIN_MODES,
  FOLLOW_BORROWER_LABEL,
  HUB_CHOICES,
  HUB_GROUP_LABEL,
  HUB_LABELS,
  HUB_TAPES,
  INITIAL_PATCH_STATE,
  JACK_LABELS,
  QUESTIONS,
  SWITCH_LABEL,
  TRIP_LINES,
  agentStatus,
  answerText,
  asSentence,
  blockedText,
  brainMode,
  cableLabel,
  cablePresent,
  cableState,
  canPullPlug,
  describeAnswer,
  describeFollow,
  describeRack,
  describeTrip,
  displayRack,
  followHint,
  freshNarration,
  hasAgent,
  hubLine,
  hubStatus,
  idleText,
  isHubChoice,
  isTravelling,
  needsHub,
  patchReducer,
  plugLabel,
  questionById,
  routeAsk,
  routeLine,
  switchState,
  visibleAsk,
  weightTag,
  type AskRoute,
  type BlockReason,
  type PatchAction,
  type PatchState,
  type RackState,
} from "./model"

const ON: RackState = { consent: true, hub: "next-door", plugged: true }
const OFF: RackState = { consent: false, hub: "next-door", plugged: true }
const PULLED: RackState = { ...ON, plugged: false }

function run(state: PatchState, ...actions: PatchAction[]): PatchState {
  return actions.reduce(patchReducer, state)
}

function on(device: DeviceId): PatchState {
  return run(INITIAL_PATCH_STATE, { type: "toggle-consent", device })
}

function tripRun(state: PatchState): number {
  return isTravelling(state.ask) ? state.ask.run : -1
}

/** Every rack the visitor can set. */
function allRacks(): RackState[] {
  const racks: RackState[] = []
  for (const hub of HUB_CHOICES) {
    for (const consent of [true, false]) {
      for (const plugged of [true, false]) racks.push({ consent, hub, plugged })
    }
  }
  return racks
}

const BLOCK_REASONS: readonly BlockReason[] = ["no-agent", "no-consent", "no-hub", "far-hub", "unreachable"]
const ROUTES: readonly AskRoute[] = [
  { kind: "here" },
  { kind: "hub" },
  ...BLOCK_REASONS.map((reason): AskRoute => ({ kind: "blocked", reason })),
]

describe("brain modes (plan §5 L3 device behaviour)", () => {
  it("maps each device as the plan says", () => {
    expect(brainMode("radio-relay")).toBe("none")
    expect(brainMode("old-phone")).toBe("borrows")
    expect(brainMode("laptop")).toBe("own")
    expect(brainMode("radio-box")).toBe("borrows")
    expect(brainMode("home-server")).toBe("split")
    expect(brainMode("gpu-pc")).toBe("lends")
  })

  it("covers every device id", () => {
    expect(Object.keys(BRAIN_MODES).sort()).toEqual([...DEVICE_IDS].sort())
  })

  it("agrees with the README table: no agent where layer 3 is not run, own brain only where it runs natively", () => {
    for (const id of DEVICE_IDS) {
      const support = layerSupport(id, 3)
      const mode = brainMode(id)
      if (support === "none") expect(mode).toBe("none")
      if (mode === "own" || mode === "lends") expect(support).toBe("runs")
      if (mode === "borrows" || mode === "split") expect(support).toBe("partly")
    }
  })

  it("only the radio relay has no agent", () => {
    expect(DEVICE_IDS.filter((id) => !hasAgent(id))).toEqual(["radio-relay"])
  })
})

describe("jacks and switch say what the rack does", () => {
  it("a borrower's agent plugs into the hub's brain", () => {
    for (const device of ["old-phone", "radio-box"] as const) {
      expect(JACK_LABELS[brainMode(device)]).toEqual({ device: "agent", hub: "brain" })
    }
  })

  it("a device that lends plugs its big brain into a borrower, never into the hub's brain", () => {
    expect(JACK_LABELS[brainMode("gpu-pc")]).toEqual({ device: "big brain", hub: "borrower" })
    expect(JACK_LABELS.own.hub).not.toMatch(/brain/)
    expect(JACK_LABELS.lends.hub).not.toMatch(/brain/)
  })

  it("the home server's small brain asks a bigger one", () => {
    expect(JACK_LABELS.split).toEqual({ device: "small brain", hub: "bigger brain" })
  })

  it("the switch and the hub chips hold for every mode (no 'run here', no 'borrow from')", () => {
    expect(SWITCH_LABEL).not.toMatch(/run here|borrow/i)
    expect(HUB_GROUP_LABEL).not.toMatch(/borrow/i)
    expect(switchState("old-phone", false)).toBe("off · you decide")
    expect(switchState("old-phone", true)).toBe("on · you agreed")
    expect(switchState("radio-relay", true)).toBe("nothing to run")
  })
})

describe("a device with no agent reads neutral (radio relay)", () => {
  it("draws the switch off, the slot empty and the plug in, whatever the rack was left at", () => {
    for (const rack of allRacks()) {
      expect(displayRack("radio-relay", rack)).toEqual({ consent: false, hub: "none", plugged: true })
    }
  })

  it("keeps the rack as set for every device with an agent", () => {
    for (const device of DEVICE_IDS.filter(hasAgent)) {
      for (const rack of allRacks()) expect(displayRack(device, rack)).toBe(rack)
    }
  })

  it("shows NOT SET on both panels, never LIVE or ERROR, even after a pulled plug", () => {
    for (const rack of allRacks()) {
      const shown = displayRack("radio-relay", rack)
      expect(agentStatus("radio-relay", shown)).toEqual({ state: "unset", label: "NOT SET · no agent" })
      expect(hubStatus("radio-relay", shown)).toEqual({ state: "unset", label: "NOT SET · no agent to patch" })
      expect(hubStatus("radio-relay", rack).state).toBe("unset")
      expect(cableState("radio-relay", shown)).toBe("none")
      expect(switchState("radio-relay", shown.consent)).toBe("nothing to run")
    }
    expect(hubLine("radio-relay", PULLED)).toMatch(/no agent/)
  })
})

describe("cable", () => {
  it("exists only while consent is on and the hub next door is chosen", () => {
    for (const device of DEVICE_IDS) {
      for (const rack of allRacks()) {
        expect(cablePresent(device, rack)).toBe(hasAgent(device) && rack.consent && rack.hub === "next-door")
      }
    }
  })

  it("is never patched to the hub across town (never over a long-range radio relay)", () => {
    for (const device of DEVICE_IDS) {
      expect(cableState(device, { ...ON, hub: "across-town" })).toBe("none")
    }
    expect(cableLabel("old-phone", { ...ON, hub: "across-town" })).toMatch(/never over a long-range radio relay/)
  })

  it("never exists on a radio relay", () => {
    expect(cableState("radio-relay", ON)).toBe("none")
    expect(cableLabel("radio-relay", ON)).toMatch(/no agent/)
  })

  it("dangles when the plug is pulled, patched when it is in", () => {
    expect(cableState("old-phone", ON)).toBe("patched")
    expect(cableState("old-phone", PULLED)).toBe("unplugged")
    expect(cableLabel("old-phone", PULLED)).toMatch(/hub unreachable/)
  })

  it("says what a patched cable is for, per brain mode", () => {
    expect(cableLabel("old-phone", ON)).toBe("patched · borrows a brain over the local mesh / Wi-Fi")
    expect(cableLabel("radio-box", ON)).toMatch(/borrows a brain/)
    expect(cableLabel("home-server", ON)).toMatch(/heavy work goes over the local mesh \/ Wi-Fi/)
    expect(cableLabel("laptop", ON)).toBe("patched · not needed: this laptop thinks here")
    expect(cableLabel("gpu-pc", ON)).toMatch(/lends its brain over the local mesh \/ Wi-Fi/)
  })

  it("says why there is none", () => {
    expect(cableLabel("laptop", OFF)).toMatch(/you decide/)
    expect(cableLabel("laptop", { ...ON, hub: "none" })).toMatch(/no hub chosen/)
  })
})

describe("statuses", () => {
  it("consent off is NOT SET with 'you decide' on every device with an agent", () => {
    for (const device of DEVICE_IDS.filter(hasAgent)) {
      const status = agentStatus(device, OFF)
      expect(status.state).toBe("unset")
      expect(status.label).toMatch(/^NOT SET/)
      expect(status.label).toMatch(/you decide/)
    }
  })

  it("every reading pairs its dot with LIVE, NOT SET or ERROR (DESIGN.md status dots)", () => {
    const words: Record<string, string> = { live: "LIVE", unset: "NOT SET", error: "ERROR", starting: "STARTING" }
    for (const device of DEVICE_IDS) {
      for (const rack of allRacks()) {
        for (const reading of [agentStatus(device, rack), hubStatus(device, rack)]) {
          expect(reading.label.startsWith(`${words[reading.state]} · `)).toBe(true)
        }
      }
    }
  })

  it("pulling the plug is ERROR 'hub unreachable' on the hub at once", () => {
    expect(hubStatus("old-phone", PULLED)).toEqual({ state: "error", label: "ERROR · hub unreachable" })
    expect(hubStatus("laptop", { ...OFF, plugged: false }).state).toBe("error")
    expect(hubStatus("old-phone", ON)).toEqual({ state: "live", label: "LIVE · reachable" })
  })

  it("a borrowing device errors with its hub; a device with its own brain stays live", () => {
    expect(agentStatus("old-phone", PULLED).state).toBe("error")
    expect(agentStatus("radio-box", PULLED).state).toBe("error")
    expect(agentStatus("laptop", PULLED).state).toBe("live")
    expect(agentStatus("home-server", PULLED).state).toBe("live")
    expect(agentStatus("gpu-pc", PULLED).state).toBe("live")
  })

  it("an empty or far slot is NOT SET, never live", () => {
    expect(hubStatus("old-phone", { ...ON, hub: "none" }).state).toBe("unset")
    expect(hubStatus("old-phone", { ...ON, hub: "across-town" }).state).toBe("unset")
    expect(agentStatus("old-phone", { ...ON, hub: "across-town" }).state).toBe("unset")
  })

  it("hub lines call the hub a neighbour", () => {
    for (const device of DEVICE_IDS.filter(hasAgent)) {
      expect(hubLine(device, ON)).toMatch(/neighbour/)
    }
  })

  it("the plug applies only to the hub next door on a device with an agent", () => {
    expect(canPullPlug("old-phone", ON)).toBe(true)
    expect(canPullPlug("old-phone", OFF)).toBe(true)
    expect(canPullPlug("old-phone", { ...ON, hub: "none" })).toBe(false)
    expect(canPullPlug("old-phone", { ...ON, hub: "across-town" })).toBe(false)
    expect(canPullPlug("radio-relay", ON)).toBe(false)
    expect(plugLabel(true)).toBe("pull the plug")
    expect(plugLabel(false)).toBe("plug it back in")
  })
})

describe("routing a question", () => {
  const light = "light" as const
  const heavy = "heavy" as const

  it("needs consent first: no consent, nothing is asked", () => {
    for (const device of DEVICE_IDS.filter(hasAgent)) {
      expect(routeAsk(device, OFF, light)).toEqual({ kind: "blocked", reason: "no-consent" })
    }
  })

  it("the radio relay has no agent", () => {
    expect(routeAsk("radio-relay", ON, light)).toEqual({ kind: "blocked", reason: "no-agent" })
  })

  it("old phone and small box with a radio borrow the hub next door for everything", () => {
    for (const device of ["old-phone", "radio-box"] as const) {
      expect(routeAsk(device, ON, light)).toEqual({ kind: "hub" })
      expect(routeAsk(device, ON, heavy)).toEqual({ kind: "hub" })
    }
  })

  it("laptop and PC with a graphics card answer everything here, even without a hub", () => {
    for (const device of ["laptop", "gpu-pc"] as const) {
      for (const rack of [ON, { ...ON, hub: "none" as const }, PULLED]) {
        expect(routeAsk(device, rack, light)).toEqual({ kind: "here" })
        expect(routeAsk(device, rack, heavy)).toEqual({ kind: "here" })
      }
    }
  })

  it("home server: small brain here for light questions, heavy work asks a bigger hub", () => {
    expect(routeAsk("home-server", ON, light)).toEqual({ kind: "here" })
    expect(routeAsk("home-server", ON, heavy)).toEqual({ kind: "hub" })
    expect(routeAsk("home-server", PULLED, light)).toEqual({ kind: "here" })
    expect(routeAsk("home-server", PULLED, heavy)).toEqual({ kind: "blocked", reason: "unreachable" })
    expect(needsHub("split", "light")).toBe(false)
    expect(needsHub("split", "heavy")).toBe(true)
  })

  it("never borrows over a long-range radio relay", () => {
    expect(routeAsk("old-phone", { ...ON, hub: "across-town" }, light)).toEqual({ kind: "blocked", reason: "far-hub" })
    expect(blockedText("old-phone", "far-hub")).toMatch(/never goes that way/)
  })

  it("an empty slot blocks a borrower", () => {
    expect(routeAsk("old-phone", { ...ON, hub: "none" }, light)).toEqual({ kind: "blocked", reason: "no-hub" })
    expect(blockedText("old-phone", "no-hub")).toMatch(/old phone/)
    expect(blockedText("home-server", "no-hub")).toMatch(/bigger hub/)
  })

  it("a pulled plug is 'hub unreachable', and the text promises no hang", () => {
    expect(routeAsk("old-phone", PULLED, light)).toEqual({ kind: "blocked", reason: "unreachable" })
    expect(blockedText("old-phone", "unreachable")).toMatch(/^Hub unreachable/)
    expect(blockedText("old-phone", "unreachable")).toMatch(/nothing hangs/)
  })

  it("prints the route in plain words", () => {
    expect(routeLine("laptop", { kind: "here" }, "light")).toBe("answered here, on this laptop")
    expect(routeLine("old-phone", { kind: "hub" }, "light")).toBe("this old phone → hub next door → back, over the local mesh")
    expect(routeLine("home-server", { kind: "hub" }, "heavy")).toMatch(/^heavy work: /)
  })
})

describe("questions and answers", () => {
  it("there are two or three canned questions", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(2)
    expect(QUESTIONS.length).toBeLessThanOrEqual(3)
  })

  it("has a light and a heavy one, so the home server's split shows", () => {
    expect(QUESTIONS.some((q) => q.weight === "light")).toBe(true)
    expect(QUESTIONS.some((q) => q.weight === "heavy")).toBe(true)
    expect(weightTag("heavy")).toBe("heavy work")
  })

  it("the fix question leaves the final say to a human", () => {
    expect(questionById("fix").answer).toMatch(/until a human approves it/)
    for (const device of DEVICE_IDS) {
      for (const rack of allRacks()) expect(answerText(device, rack, "fix")).toMatch(/until a human approves it/)
    }
  })

  it("the health monitor never says 'nothing to fix' next to a red 'hub unreachable'", () => {
    const health = questionById("health")
    let answered = 0
    for (const device of DEVICE_IDS.filter(hasAgent)) {
      expect(hubStatus(device, PULLED).state).toBe("error")
      // A borrower never gets this far: its question is blocked "hub unreachable".
      if (routeAsk(device, PULLED, health.weight).kind === "blocked") continue
      answered += 1
      expect(answerText(device, PULLED, "health")).not.toMatch(/Nothing to fix/)
    }
    expect(answered).toBe(3)
  })

  it("health with the plug pulled: the home server's heavy work waits", () => {
    expect(answerText("home-server", PULLED, "health")).toBe(
      "Every layer this device runs looks healthy, but the hub next door is unreachable: heavy work waits until it is back.",
    )
  })

  it("health with no bigger hub nearby: the home server says heavy work waits for one", () => {
    for (const hub of ["none", "across-town"] as const) {
      expect(answerText("home-server", { ...ON, hub }, "health")).toMatch(/no bigger hub is nearby/)
    }
  })

  it("health with the plug pulled: the laptop does not need the hub", () => {
    expect(answerText("laptop", PULLED, "health")).toMatch(/unreachable, and this laptop does not need it/)
  })

  it("health with the plug pulled: the PC with a graphics card cannot lend until the plug is back", () => {
    expect(answerText("gpu-pc", PULLED, "health")).toMatch(/cannot borrow this brain until the plug is back in/)
  })

  it("health with the hub in: everything is healthy", () => {
    for (const device of DEVICE_IDS.filter(hasAgent)) {
      expect(answerText(device, ON, "health")).toBe(questionById("health").answer)
    }
  })

  it("throws on an unknown id", () => {
    // @ts-expect-error: not a QuestionId
    expect(() => questionById("nope")).toThrow()
  })
})

describe("printout and follow shortcut", () => {
  it("the shortcut follows a device that borrows", () => {
    expect(brainMode(BORROWER_DEVICE)).toBe("borrows")
    expect(FOLLOW_BORROWER_LABEL).toContain(deviceById(BORROWER_DEVICE).label)
  })

  it("points to the borrowing case wherever the device's own questions never travel", () => {
    for (const device of DEVICE_IDS) {
      const mode = brainMode(device)
      const never = mode === "none" || mode === "own" || mode === "lends"
      expect(followHint(device) != null).toBe(never)
    }
  })

  it("the idle printout says nothing travels on the laptop and the PC with a graphics card", () => {
    expect(idleText("laptop")).toMatch(/nothing travels along the cable/)
    expect(idleText("gpu-pc")).toMatch(/lends its brain, so nothing it asks travels/)
    expect(idleText("home-server")).toMatch(/heavy work travels/)
  })
})

describe("reducer", () => {
  it("starts with consent off, the hub next door in the slot, plugged in, nothing asked", () => {
    expect(INITIAL_PATCH_STATE).toMatchObject({ consent: false, hub: "next-door", plugged: true, ask: { phase: "idle" } })
    expect(cableState("old-phone", INITIAL_PATCH_STATE)).toBe("none")
  })

  it("the consent switch toggles and narrates", () => {
    const s = on("old-phone")
    expect(s.consent).toBe(true)
    expect(s.narration).toMatch(/borrows the hub next door/)
    const back = run(s, { type: "toggle-consent", device: "old-phone" })
    expect(back.consent).toBe(false)
    expect(back.narration).toBe("Agent off: you decide. In the slot: the hub next door.")
  })

  it("with consent off, every slot or plug change names what is now in the slot", () => {
    const right = run(INITIAL_PATCH_STATE, { type: "choose-hub", device: "old-phone", hub: "across-town" })
    expect(right.narration).toBe("Agent off: you decide. In the slot: the hub across town, too far.")
    const left = run(right, { type: "choose-hub", device: "old-phone", hub: "next-door" })
    expect(left.narration).toBe("Agent off: you decide. In the slot: the hub next door.")
    expect(left.narration).not.toMatch(/^Again:/)
    const empty = run(left, { type: "choose-hub", device: "old-phone", hub: "none" })
    expect(empty.narration).toBe("Agent off: you decide. In the slot: nothing.")
    const pulled = run(INITIAL_PATCH_STATE, { type: "toggle-plug", device: "laptop" })
    expect(pulled.consent).toBe(false)
    expect(pulled.narration).toBe("Agent off: you decide. In the slot: the hub next door, unreachable.")
    // Each consent-off rack reads differently, so no change is announced as "Again:".
    for (const device of DEVICE_IDS.filter(hasAgent)) {
      const lines = allRacks()
        .filter((r) => !r.consent && (r.hub === "next-door" || r.plugged))
        .map((r) => describeRack(device, r))
      expect(new Set(lines).size).toBe(lines.length)
    }
  })

  it("a radio relay ignores every rack control", () => {
    const s = run(
      INITIAL_PATCH_STATE,
      { type: "toggle-consent", device: "radio-relay" },
      { type: "choose-hub", device: "radio-relay", hub: "none" },
      { type: "toggle-plug", device: "radio-relay" },
    )
    expect(s).toBe(INITIAL_PATCH_STATE)
  })

  it("choosing a hub clears the printout; the same hub is a no-op", () => {
    const asked = run(on("laptop"), { type: "ask", device: "laptop", question: "health", reducedMotion: false })
    expect(asked.ask.phase).toBe("done")
    expect(run(asked, { type: "choose-hub", device: "laptop", hub: "next-door" })).toBe(asked)
    const moved = run(asked, { type: "choose-hub", device: "laptop", hub: "none" })
    expect(moved.hub).toBe("none")
    expect(moved.ask.phase).toBe("idle")
  })

  it("a local answer prints whole at once (no trip)", () => {
    const s = run(on("laptop"), { type: "ask", device: "laptop", question: "health", reducedMotion: false })
    expect(s.ask).toMatchObject({ phase: "done", route: { kind: "here" }, question: "health" })
    expect(s.narration).toBe(`Is my node healthy? Answered here, on this laptop: ${questionById("health").answer}`)
  })

  it("a borrowed answer travels out, back, then prints", () => {
    let s = run(on("old-phone"), { type: "ask", device: "old-phone", question: "waited", reducedMotion: false })
    expect(s.ask.phase).toBe("out")
    expect(isTravelling(s.ask)).toBe(true)
    const runId = tripRun(s)
    s = run(s, { type: "advance", run: runId, device: "old-phone" })
    expect(s.ask.phase).toBe("back")
    s = run(s, { type: "advance", run: runId, device: "old-phone" })
    expect(s.ask).toMatchObject({ phase: "done", route: { kind: "hub" } })
    expect(s.narration).toMatch(/^Why did my message wait\? Answered by the hub next door/)
  })

  it("under reduced motion the trip is cut: the answer prints at once", () => {
    const s = run(on("old-phone"), { type: "ask", device: "old-phone", question: "waited", reducedMotion: true })
    expect(s.ask).toMatchObject({ phase: "done", route: { kind: "hub" } })
  })

  it("ignores a second question while one is travelling for the same device", () => {
    const s = run(on("old-phone"), { type: "ask", device: "old-phone", question: "waited", reducedMotion: false })
    expect(run(s, { type: "ask", device: "old-phone", question: "fix", reducedMotion: false })).toBe(s)
  })

  it("a stale timer tick never advances a newer trip", () => {
    const s = run(on("old-phone"), { type: "ask", device: "old-phone", question: "waited", reducedMotion: false })
    expect(run(s, { type: "advance", run: 999, device: "old-phone" })).toBe(s)
    expect(run(INITIAL_PATCH_STATE, { type: "advance", run: 1, device: "old-phone" })).toBe(INITIAL_PATCH_STATE)
  })

  it("pulling the plug mid-trip fails at once with 'hub unreachable' (no hang)", () => {
    const s = run(
      on("old-phone"),
      { type: "ask", device: "old-phone", question: "waited", reducedMotion: false },
      { type: "toggle-plug", device: "old-phone" },
    )
    expect(s.plugged).toBe(false)
    expect(s.ask).toMatchObject({ phase: "done", route: { kind: "blocked", reason: "unreachable" } })
    expect(s.narration).toBe(`Why did my message wait? ${blockedText("old-phone", "unreachable")}`)
  })

  it("asking with the plug pulled answers 'hub unreachable' at once, no trip", () => {
    const s = run(
      on("old-phone"),
      { type: "toggle-plug", device: "old-phone" },
      { type: "ask", device: "old-phone", question: "health", reducedMotion: false },
    )
    expect(s.ask).toMatchObject({ phase: "done", route: { kind: "blocked", reason: "unreachable" } })
  })

  it("plugging back in restores the cable and the borrowed brain", () => {
    const pulled = run(on("old-phone"), { type: "toggle-plug", device: "old-phone" })
    expect(cableState("old-phone", pulled)).toBe("unplugged")
    expect(pulled.narration).toMatch(/hub unreachable/)
    const back = run(pulled, { type: "toggle-plug", device: "old-phone" })
    expect(back.plugged).toBe(true)
    expect(cableState("old-phone", back)).toBe("patched")
    expect(agentStatus("old-phone", back).state).toBe("live")
    const asked = run(back, { type: "ask", device: "old-phone", question: "health", reducedMotion: true })
    expect(asked.ask).toMatchObject({ phase: "done", route: { kind: "hub" } })
  })

  it("turning consent off mid-trip drops the question", () => {
    const s = run(
      on("old-phone"),
      { type: "ask", device: "old-phone", question: "waited", reducedMotion: false },
      { type: "toggle-consent", device: "old-phone" },
    )
    expect(s.ask.phase).toBe("idle")
    expect(s.consent).toBe(false)
  })

  it("the home server's heavy question travels, its light one does not", () => {
    const light = run(on("home-server"), { type: "ask", device: "home-server", question: "health", reducedMotion: false })
    expect(light.ask).toMatchObject({ phase: "done", route: { kind: "here" } })
    const heavy = run(on("home-server"), { type: "ask", device: "home-server", question: "fix", reducedMotion: false })
    expect(heavy.ask.phase).toBe("out")
  })

  it("a question asked for another device reads as idle", () => {
    const s = run(on("laptop"), { type: "ask", device: "laptop", question: "health", reducedMotion: false })
    expect(visibleAsk(s.ask, "laptop").phase).toBe("done")
    expect(visibleAsk(s.ask, "old-phone").phase).toBe("idle")
  })

  it("isHubChoice guards the chip values", () => {
    expect(isHubChoice("next-door")).toBe(true)
    expect(isHubChoice("cloud")).toBe(false)
  })
})

describe("following another device mid-trip (changed in L1)", () => {
  const asked = run(on("old-phone"), { type: "ask", device: "old-phone", question: "waited", reducedMotion: false })

  it("hides the old trip and leaves the new device's questions free", () => {
    expect(isTravelling(visibleAsk(asked.ask, "radio-box"))).toBe(false)
    const next = run(asked, { type: "ask", device: "radio-box", question: "health", reducedMotion: false })
    expect(next.ask).toMatchObject({ phase: "out", device: "radio-box", question: "health" })
  })

  it("drops the old trip quietly when its timer fires: no announcement for a device no longer shown", () => {
    const tick = run(asked, { type: "advance", run: tripRun(asked), device: "laptop" })
    expect(tick.ask.phase).toBe("idle")
    expect(tick.narration).toBe(asked.narration)
  })

  it("pulling the plug then never narrates the old device's question", () => {
    const pulled = run(asked, { type: "toggle-plug", device: "radio-box" })
    expect(pulled.ask.phase).toBe("idle")
    expect(pulled.plugged).toBe(false)
    expect(pulled.narration).toBe(describeRack("radio-box", PULLED))
  })

  it("following the same device back resumes the trip", () => {
    const tick = run(asked, { type: "advance", run: tripRun(asked), device: "old-phone" })
    expect(tick.ask.phase).toBe("back")
  })
})

describe("the follow shortcut", () => {
  it("clears the printout and narrates the device it now follows", () => {
    const asked = run(on("laptop"), { type: "ask", device: "laptop", question: "health", reducedMotion: false })
    const s = run(asked, { type: "follow", device: BORROWER_DEVICE })
    expect(s.ask.phase).toBe("idle")
    expect(s.consent).toBe(true)
    expect(s.narration).toBe("Following: old phone. Cable in: this old phone borrows the hub next door's brain.")
    expect(describeFollow("old-phone", OFF)).toBe(
      "Following: old phone. Agent off: you decide. In the slot: the hub next door.",
    )
  })

  it("from the default device, one follow plus consent on makes the trip one ask away", () => {
    const s = run(
      INITIAL_PATCH_STATE,
      { type: "follow", device: BORROWER_DEVICE },
      { type: "toggle-consent", device: BORROWER_DEVICE },
      { type: "ask", device: BORROWER_DEVICE, question: "health", reducedMotion: false },
    )
    expect(s.ask.phase).toBe("out")
  })
})

describe("narration (one polite live line)", () => {
  it("separates the question from what follows with a sentence break", () => {
    expect(asSentence("Find a fix for the flaky link")).toBe("Find a fix for the flaky link.")
    expect(asSentence("Is my node healthy?")).toBe("Is my node healthy?")
    expect(describeTrip(questionById("fix"))).toBe(
      "Asked: Find a fix for the flaky link. Sent over the local mesh to the hub next door.",
    )
    for (const q of QUESTIONS) {
      for (const route of ROUTES) {
        const line = describeAnswer("home-server", ON, q, route)
        expect(line.startsWith(asSentence(q.text))).toBe(true)
        expect(line).toMatch(/^[^.?!]*[.?!] [A-Z]/)
      }
    }
  })

  it("names the question in every result, so a different question always announces", () => {
    const first = run(INITIAL_PATCH_STATE, { type: "ask", device: "laptop", question: "health", reducedMotion: false })
    const second = run(first, { type: "ask", device: "laptop", question: "waited", reducedMotion: false })
    expect(first.ask).toMatchObject({ route: { kind: "blocked", reason: "no-consent" } })
    expect(second.narration).not.toBe(first.narration)
    for (const device of DEVICE_IDS) {
      for (const reason of BLOCK_REASONS) {
        const lines = QUESTIONS.map((q) => describeAnswer(device, ON, q, { kind: "blocked", reason }))
        expect(new Set(lines).size).toBe(QUESTIONS.length)
      }
    }
  })

  it("an exact repeat still announces, marked 'Again:'", () => {
    const ask: PatchAction = { type: "ask", device: "laptop", question: "health", reducedMotion: false }
    const once = run(on("laptop"), ask)
    const twice = run(once, ask)
    const thrice = run(twice, ask)
    expect(twice.narration).toBe(`Again: ${once.narration}`)
    expect(thrice.narration).toBe(once.narration)
    expect(freshNarration("a", "b")).toBe("b")
  })
})

describe("copy (plan §5 L3 rules, §7 Honesty)", () => {
  /** Every user-visible string the model can emit, over every device, rack, question and route. */
  function allCopy(): string[] {
    const out: string[] = [
      ...Object.values(BRAIN_LINES),
      ...Object.values(HUB_LABELS),
      ...Object.values(HUB_TAPES),
      ...Object.values(JACK_LABELS).flatMap((j) => [j.device, j.hub]),
      ...Object.values(TRIP_LINES),
      SWITCH_LABEL,
      HUB_GROUP_LABEL,
      FOLLOW_BORROWER_LABEL,
      plugLabel(true),
      plugLabel(false),
      weightTag("light"),
      weightTag("heavy"),
      ...QUESTIONS.flatMap((q) => [q.text, q.answer, describeTrip(q)]),
    ]
    for (const device of DEVICE_IDS) {
      out.push(idleText(device), followHint(device) ?? "")
      for (const reason of BLOCK_REASONS) out.push(blockedText(device, reason))
      for (const rack of allRacks()) {
        const shown = displayRack(device, rack)
        out.push(
          cableLabel(device, shown),
          agentStatus(device, shown).label,
          hubStatus(device, shown).label,
          hubLine(device, shown),
          switchState(device, shown.consent),
          describeRack(device, shown),
          describeFollow(device, shown),
        )
        for (const q of QUESTIONS) {
          out.push(answerText(device, shown, q.id))
          for (const route of ROUTES) {
            out.push(routeLine(device, route, q.weight), describeAnswer(device, shown, q, route))
          }
        }
      }
    }
    return out
  }

  it("has no digits anywhere: no counts, sizes or statistics", () => {
    for (const line of allCopy()) expect(line).not.toMatch(/\d/)
  })

  it("never calls a hub a server (the device's own name 'home server' aside)", () => {
    for (const line of allCopy()) expect(line.replaceAll("home server", "")).not.toMatch(/server/i)
  })

  it("never offers the cloud or a long-range relay as a way to borrow", () => {
    for (const line of allCopy()) {
      expect(line).not.toMatch(/cloud/i)
      if (/long-range radio relay/.test(line)) expect(line).toMatch(/never|only/)
    }
  })
})
