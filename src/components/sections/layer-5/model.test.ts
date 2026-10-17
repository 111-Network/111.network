import { describe, expect, it } from "vitest"
import {
  CARGO_KINDS,
  DELIVERY_STATES,
  HOPS,
  HUB,
  HUB_SEES,
  INITIAL_STATE,
  LINK_LABELS,
  NO_LINKS,
  PASSER_SEES,
  RECIPIENT,
  SAMPLE_MESSAGE,
  SENDER,
  STATE_SENTENCE,
  STATE_STEP,
  STATIONS,
  canAdvance,
  canWait,
  carriedLabel,
  courierReducer,
  hopOpen,
  hopView,
  narrate,
  sealedNoise,
  sendProblem,
  senderCopyKept,
  settle,
  stationTag,
  step,
  tickDelay,
  waitLine,
  waitNote,
  waitProblem,
  waitingAt,
  yearsText,
  type CourierAction,
  type CourierState,
  type DeliveryState,
  type LinkKind,
  type Links,
} from "./model"

const run = (state: CourierState, ...actions: CourierAction[]): CourierState => actions.reduce(courierReducer, state)

const withLinks = (...on: LinkKind[]): CourierState => ({
  ...INITIAL_STATE,
  links: { ...NO_LINKS, ...Object.fromEntries(on.map((k) => [k, true])) } as Links,
})

/** Every state the parcel passes through while ticking until nothing moves. */
function tickAll(state: CourierState): CourierState[] {
  const seen: CourierState[] = [state]
  let current = state
  for (let n = 0; n < 100; n++) {
    const next = courierReducer(current, { type: "tick" })
    if (next === current) break
    seen.push(next)
    current = next
  }
  return seen
}

describe("route and links", () => {
  it("has the five stations of the plan, top to bottom, with their notes verbatim", () => {
    expect(STATIONS.map((s) => `${s.name} (${s.note})`)).toEqual([
      "YOU (laptop)",
      "HUB (stays on, holds a sealed copy)",
      "RELAY (repeats it)",
      "THEIR BRIDGE (a small box with a radio; passes it to Wi-Fi)",
      "THEM (their phone)",
    ])
    expect(STATIONS[SENDER].id).toBe("you")
    expect(STATIONS[HUB].id).toBe("hub")
    expect(STATIONS[RECIPIENT].id).toBe("them")
  })

  it("needs short range at both ends and long-range radio across the middle", () => {
    expect(HOPS.map((h) => [...h.links])).toEqual([["wifi", "bluetooth"], ["radio"], ["radio"], ["wifi", "bluetooth"]])
    expect(hopOpen({ ...NO_LINKS, wifi: true }, 0)).toBe(true)
    expect(hopOpen({ ...NO_LINKS, bluetooth: true }, 0)).toBe(true)
    expect(hopOpen({ ...NO_LINKS, radio: true }, 0)).toBe(false)
    expect(hopOpen({ ...NO_LINKS, radio: true }, 1)).toBe(true)
    expect(hopOpen({ ...NO_LINKS, wifi: true, bluetooth: true }, 2)).toBe(false)
    expect(hopOpen({ ...NO_LINKS, bluetooth: true }, 3)).toBe(true)
    expect(hopOpen({ wifi: true, bluetooth: true, radio: true }, 4)).toBe(false)
  })

  it("uses plain link words only", () => {
    expect(Object.values(LINK_LABELS)).toEqual(["Wi-Fi", "Bluetooth", "long-range radio"])
  })

  it("prints the station disclosure lines verbatim", () => {
    expect(HUB_SEES).toBe("sees: who it is for, a size · can read it: no · can change it: no")
    expect(PASSER_SEES).toBe("sees: a locator, a size, noise · can read it: no · can change it: no")
    expect(STATIONS.map((s) => s.sees)).toEqual([null, HUB_SEES, PASSER_SEES, PASSER_SEES, null])
  })

  it("lets only a relay go without keeping a copy", () => {
    expect(STATIONS.filter((s) => !s.holds).map((s) => s.id)).toEqual(["relay"])
  })
})

describe("state words", () => {
  it("keeps the four states in order of evidence", () => {
    expect(DELIVERY_STATES).toEqual(["queued", "sent", "relayed", "delivered"])
    expect(DELIVERY_STATES.map((s) => STATE_STEP[s])).toEqual([0, 1, 2, 3])
  })

  it("uses the plan's shortened sentences (and the dashboard's for sent)", () => {
    expect(STATE_SENTENCE.queued).toBe("In your outbox: no path to them yet.")
    expect(STATE_SENTENCE.sent).toBe("A frame was written to a link. They have not confirmed it yet.")
    expect(STATE_SENTENCE.relayed).toBe("A mailbox node saved it and will hold it for them.")
    expect(STATE_SENTENCE.delivered).toBe("Their node acknowledged it. Only that says delivered.")
  })

  it("counts years in words", () => {
    expect(yearsText(0)).toBe("under a year")
    expect(yearsText(1)).toBe("1 year")
    expect(yearsText(2)).toBe("2 years")
    expect(yearsText(12)).toBe("12 years")
  })
})

describe("initial state", () => {
  it("starts with the sample line, all links off and nothing sent", () => {
    expect(INITIAL_STATE.draft).toBe(SAMPLE_MESSAGE)
    expect(INITIAL_STATE.links).toEqual(NO_LINKS)
    expect(INITIAL_STATE.parcel).toBeNull()
    expect(sendProblem(INITIAL_STATE)).toBeNull()
    expect(canWait(INITIAL_STATE)).toBe(false)
    expect(narrate(INITIAL_STATE)).toBe("")
    expect(waitLine(NO_LINKS, null)).toEqual({ label: "waiting for", value: "nothing sent yet" })
    expect(waitProblem(INITIAL_STATE)).toBe("Press SEND first.")
  })
})

describe("SEND", () => {
  it("with no link at all: queued, in the outbox, waiting for Wi-Fi or Bluetooth", () => {
    const s = run(INITIAL_STATE, { type: "send" })
    expect(s.parcel?.state).toBe("queued")
    expect(s.parcel?.courier).toEqual({ cargo: "message", at: SENDER, moving: false })
    expect(canAdvance(s.links, s.parcel)).toBe(false)
    expect(waitingAt(s.links, s.parcel)).toEqual({ station: SENDER, hop: 0, cargo: "message" })
    expect(narrate(s)).toContain("In your outbox: no path to them yet.")
    expect(narrate(s)).toContain("Wi-Fi or Bluetooth")
  })

  it("with only long-range radio: still queued (the laptop reaches the hub over short range)", () => {
    const s = run(withLinks("radio"), { type: "send", instant: true })
    expect(s.parcel?.state).toBe("queued")
    expect(s.parcel?.reached).toBe(SENDER)
  })

  it("with Wi-Fi: written to a link at once (sent), then the hub saves it (relayed) and it waits for radio", () => {
    const sent = run(withLinks("wifi"), { type: "send" })
    expect(sent.parcel?.state).toBe("sent")
    expect(sent.parcel?.courier).toEqual({ cargo: "message", at: SENDER, moving: true })

    const settled = run(sent, { type: "settle" })
    expect(settled.parcel?.state).toBe("relayed")
    expect(settled.parcel?.reached).toBe(HUB)
    expect(waitingAt(settled.links, settled.parcel)).toEqual({ station: HUB, hop: 1, cargo: "message" })
    expect(narrate(settled)).toContain("A mailbox node saved it and will hold it for them.")
    expect(narrate(settled)).toContain("at the hub for long-range radio")
  })

  it("Bluetooth alone also reaches the hub", () => {
    const s = run(withLinks("bluetooth"), { type: "send", instant: true })
    expect(s.parcel?.state).toBe("relayed")
  })

  it("with every link on: delivered, and the sender's copy is released", () => {
    const s = run(withLinks("wifi", "bluetooth", "radio"), { type: "send", instant: true })
    expect(s.parcel?.state).toBe("delivered")
    expect(s.parcel?.courier).toBeNull()
    expect(s.parcel?.reached).toBe(RECIPIENT)
    expect(senderCopyKept(s.parcel)).toBe(false)
    expect(narrate(s)).toBe("Delivered. Their node acknowledged it. Only that says delivered. Your copy is released.")
  })

  it("sends the line exactly as typed, with no length limit", () => {
    const long = "word ".repeat(5000)
    const s = run(INITIAL_STATE, { type: "draft", text: long }, { type: "send" })
    expect(s.parcel?.text).toBe(long)
    expect(sendProblem(run(INITIAL_STATE, { type: "draft", text: long }))).toBeNull()
  })

  it("refuses an empty line", () => {
    const s = run(INITIAL_STATE, { type: "draft", text: "   " })
    expect(sendProblem(s)).toBe("Write something first.")
    expect(run(s, { type: "send" })).toBe(s)
  })

  it("tracks one message per receipt: SEND does nothing until delivered, then a new parcel starts fresh", () => {
    const first = run(INITIAL_STATE, { type: "send" }, { type: "wait" }, { type: "wait" })
    expect(sendProblem(first)).toBe("This receipt tracks one message. Deliver it, then SEND prints a new one.")
    expect(run(first, { type: "send" })).toBe(first)

    const delivered = run(first, { type: "toggle", link: "wifi", instant: true }, { type: "toggle", link: "radio", instant: true })
    expect(delivered.parcel?.state).toBe("delivered")
    expect(sendProblem(delivered)).toBeNull()

    const second = run(delivered, { type: "draft", text: "Again." }, { type: "send" })
    expect(second.parcel?.id).toBe(2)
    expect(second.parcel?.text).toBe("Again.")
    expect(second.parcel?.years).toBe(0)
    expect(second.parcel?.state).toBe("sent")
  })

  it("editing the line never changes a message already sent", () => {
    const s = run(INITIAL_STATE, { type: "send" }, { type: "draft", text: "changed my mind" })
    expect(s.parcel?.text).toBe(SAMPLE_MESSAGE)
    expect(s.draft).toBe("changed my mind")
  })
})

describe("store and forward", () => {
  it("walks queued → sent → relayed → delivered as links come on later", () => {
    const queued = run(INITIAL_STATE, { type: "send" })
    expect(queued.parcel?.state).toBe("queued")

    const relayed = run(queued, { type: "toggle", link: "wifi", instant: true })
    expect(relayed.parcel?.state).toBe("relayed")
    expect(relayed.parcel?.courier?.at).toBe(HUB)

    const delivered = run(relayed, { type: "toggle", link: "radio", instant: true })
    expect(delivered.parcel?.state).toBe("delivered")
  })

  it("goes as far as the links allow: radio without short range waits at their bridge", () => {
    const atHub = run(withLinks("wifi"), { type: "send", instant: true })
    const atBridge = run(atHub, { type: "toggle", link: "wifi", instant: true }, { type: "toggle", link: "radio", instant: true })
    expect(atBridge.parcel?.state).toBe("relayed")
    expect(atBridge.parcel?.reached).toBe(3)
    expect(waitingAt(atBridge.links, atBridge.parcel)).toEqual({ station: 3, hop: 3, cargo: "message" })
    expect(narrate(atBridge)).toContain("at their bridge for Wi-Fi or Bluetooth")

    const delivered = run(atBridge, { type: "toggle", link: "bluetooth", instant: true })
    expect(delivered.parcel?.state).toBe("delivered")
  })

  it("a toggle that opens the next hop sends it off on the click; the timer only handles the arrival", () => {
    const queued = run(INITIAL_STATE, { type: "send" })
    const toggled = run(queued, { type: "toggle", link: "wifi" })
    expect(toggled.parcel?.state).toBe("sent")
    expect(toggled.parcel?.courier).toEqual({ cargo: "message", at: SENDER, moving: true })
    expect(hopView(toggled, 0).carrying).toBe("message")
    const ticked = run(toggled, { type: "tick" })
    expect(ticked.parcel?.state).toBe("relayed")
    expect(ticked.parcel?.reached).toBe(HUB)
  })

  it("a toggle resumes a message waiting further down the route on the click too", () => {
    const atHub = run(withLinks("wifi"), { type: "send", instant: true })
    const toggled = run(atHub, { type: "toggle", link: "radio" })
    expect(toggled.parcel?.courier).toEqual({ cargo: "message", at: HUB, moving: true })
  })

  it("a toggle that opens nothing new leaves the parcel as it is", () => {
    const queued = run(INITIAL_STATE, { type: "send" })
    const radio = run(queued, { type: "toggle", link: "radio" })
    expect(radio.parcel).toBe(queued.parcel)

    const moving = run(withLinks("wifi"), { type: "send" })
    const extra = run(moving, { type: "toggle", link: "bluetooth" })
    expect(extra.parcel).toBe(moving.parcel)
    // Wi-Fi off while Bluetooth still carries the hop: the frame keeps going.
    const swapped = run(extra, { type: "toggle", link: "wifi" })
    expect(swapped.parcel).toBe(moving.parcel)
  })

  it("a toggle that closes the hop being crossed loses that frame on the click", () => {
    const moving = run(withLinks("wifi"), { type: "send" })
    const dropped = run(moving, { type: "toggle", link: "wifi" })
    expect(dropped.parcel?.courier).toEqual({ cargo: "message", at: SENDER, moving: false })
    expect(dropped.parcel?.state).toBe("sent")
    expect(hopView(dropped, 0).carrying).toBeNull()
  })

  it("only the hub's saved copy makes it relayed", () => {
    const states = tickAll(run(withLinks("wifi", "radio"), { type: "send" }))
    for (const s of states) {
      if ((s.parcel?.reached ?? 0) < HUB) expect(s.parcel?.state).not.toBe("relayed")
      else expect(s.parcel?.state).not.toBe("sent")
    }
  })

  it("says delivered only once their acknowledgement is back at the sender", () => {
    const states = tickAll(run(withLinks("wifi", "radio"), { type: "send" }))
    const last = states[states.length - 1]
    expect(last.parcel?.state).toBe("delivered")

    const arrived = states.findIndex((s) => s.parcel?.courier?.cargo === "ack")
    expect(arrived).toBeGreaterThan(0)
    // Their phone has it, the acknowledgement is travelling back: still relayed.
    for (const s of states.slice(arrived, -1)) {
      expect(s.parcel?.reached).toBe(RECIPIENT)
      expect(s.parcel?.state).toBe("relayed")
      expect(senderCopyKept(s.parcel)).toBe(true)
    }
    expect(states.filter((s) => s.parcel?.state === "delivered")).toHaveLength(1)
  })

  it("keeps the sender's copy in every state before delivered", () => {
    const states = tickAll(run(withLinks("bluetooth", "radio"), { type: "send" }))
    const before: DeliveryState[] = []
    for (const s of states) {
      if (s.parcel?.state !== "delivered") {
        before.push(s.parcel!.state)
        expect(senderCopyKept(s.parcel)).toBe(true)
      }
    }
    expect(new Set(before)).toEqual(new Set(["sent", "relayed"]))
    expect(senderCopyKept(run(INITIAL_STATE, { type: "send" }).parcel)).toBe(true)
  })

  it("an acknowledgement stuck on the way back leaves it relayed until the link returns", () => {
    const states = tickAll(run(withLinks("wifi", "radio"), { type: "send" }))
    const ackMoving = states.find((s) => s.parcel?.courier?.cargo === "ack" && s.parcel.courier.moving && s.parcel.courier.at === 3)
    expect(ackMoving).toBeDefined()
    // Radio drops while the acknowledgement crosses from their bridge to the relay.
    const stuck = run(ackMoving!, { type: "toggle", link: "radio" }, { type: "settle" })
    expect(stuck.parcel?.state).toBe("relayed")
    expect(waitingAt(stuck.links, stuck.parcel)).toEqual({ station: 3, hop: 2, cargo: "ack" })
    expect(narrate(stuck)).toContain("its acknowledgement waits at their bridge for long-range radio")
    expect(senderCopyKept(stuck.parcel)).toBe(true)

    const delivered = run(stuck, { type: "toggle", link: "radio", instant: true })
    expect(delivered.parcel?.state).toBe("delivered")
  })

  it("a link that drops mid-hop leaves it sent (never back to queued) in your outbox", () => {
    const moving = run(withLinks("wifi"), { type: "send" })
    const dropped = run(moving, { type: "toggle", link: "wifi" }, { type: "tick" })
    expect(dropped.parcel?.state).toBe("sent")
    expect(dropped.parcel?.courier).toEqual({ cargo: "message", at: SENDER, moving: false })
    expect(narrate(dropped)).toContain("A frame was written to a link. They have not confirmed it yet.")
    expect(narrate(dropped)).toContain("in your outbox")

    const resumed = run(dropped, { type: "toggle", link: "bluetooth", instant: true })
    expect(resumed.parcel?.state).toBe("relayed")
  })

  it("a relay keeps nothing: radio lost past the relay falls back to the hub's copy", () => {
    const states = tickAll(run(withLinks("wifi", "radio"), { type: "send" }))
    const pastRelay = states.find((s) => s.parcel?.courier?.cargo === "message" && s.parcel.courier.at === 2 && s.parcel.courier.moving)
    expect(pastRelay).toBeDefined()
    const dropped = run(pastRelay!, { type: "toggle", link: "radio" }, { type: "tick" })
    expect(dropped.parcel?.courier).toEqual({ cargo: "message", at: HUB, moving: false })
    expect(dropped.parcel?.state).toBe("relayed")
  })

  it("settle reaches the same place as ticking one by one", () => {
    for (const on of [[], ["wifi"], ["radio"], ["bluetooth", "radio"], ["wifi", "bluetooth", "radio"]] as LinkKind[][]) {
      const start = run(withLinks(...on), { type: "send" })
      const ticked = tickAll(start)
      expect(run(start, { type: "settle" }).parcel).toEqual(ticked[ticked.length - 1].parcel)
    }
  })

  it("a tick with nothing to move returns the same state", () => {
    const queued = run(INITIAL_STATE, { type: "send" })
    expect(run(queued, { type: "tick" })).toBe(queued)
    expect(run(INITIAL_STATE, { type: "tick" })).toBe(INITIAL_STATE)
    expect(step(queued.links, queued.parcel!)).toBe(queued.parcel)
    expect(settle(queued.links, queued.parcel!)).toBe(queued.parcel)
  })

  it("moves the acknowledgement a little faster than the message", () => {
    const states = tickAll(run(withLinks("wifi", "radio"), { type: "send" }))
    const ack = states.find((s) => s.parcel?.courier?.cargo === "ack" && s.parcel.courier.moving)
    expect(tickDelay(ack!.parcel)).toBeLessThan(tickDelay(states[0].parcel))
  })
})

describe("WAIT A YEAR", () => {
  it("adds a year while it waits and changes nothing else", () => {
    const atHub = run(withLinks("wifi"), { type: "send", instant: true })
    expect(canWait(atHub)).toBe(true)
    const one = run(atHub, { type: "wait" })
    const three = run(one, { type: "wait" }, { type: "wait" })
    expect(one.parcel?.years).toBe(1)
    expect(three.parcel?.years).toBe(3)
    expect({ ...three.parcel, years: 0 }).toEqual(atHub.parcel)
    expect(three.links).toEqual(atHub.links)
    expect(waitLine(three.links, three.parcel)).toEqual({ label: "waiting for", value: "3 years" })
    expect(narrate(three)).toContain("Waiting for: 3 years. Expiry: none.")
    expect(narrate(three)).toContain(STATE_SENTENCE.relayed)
  })

  it("works the same for a queued message: years pass, it stays queued", () => {
    const queued = run(INITIAL_STATE, { type: "send" })
    const later = run(queued, { type: "wait" }, { type: "wait" }, { type: "wait" }, { type: "wait" })
    expect(later.parcel?.state).toBe("queued")
    expect(later.parcel?.years).toBe(4)
  })

  it("does nothing before SEND, while it is on its way, and once delivered, and says why", () => {
    expect(run(INITIAL_STATE, { type: "wait" })).toBe(INITIAL_STATE)
    expect(waitProblem(INITIAL_STATE)).toBe("Press SEND first.")

    const moving = run(withLinks("wifi"), { type: "send" })
    expect(canWait(moving)).toBe(false)
    expect(waitProblem(moving)).toBe("Nothing waits while it is on its way.")
    expect(run(moving, { type: "wait" })).toBe(moving)

    const delivered = run(withLinks("wifi", "radio"), { type: "send", instant: true })
    expect(canWait(delivered)).toBe(false)
    expect(waitProblem(delivered)).toBe("Delivered: nothing is waiting.")
    expect(run(delivered, { type: "wait" })).toBe(delivered)

    const waiting = run(INITIAL_STATE, { type: "send" })
    expect(waitProblem(waiting)).toBeNull()
    expect(canWait(waiting)).toBe(true)
  })

  it("says 'waiting for' only while it rests: on the move it has only waited", () => {
    const queued = run(INITIAL_STATE, { type: "send" }, { type: "wait" }, { type: "wait" })
    expect(waitLine(queued.links, queued.parcel)).toEqual({ label: "waiting for", value: "2 years" })
    expect(narrate(queued)).toContain("Waiting for: 2 years. Expiry: none.")

    const moving = run(queued, { type: "toggle", link: "wifi" })
    expect(moving.parcel?.courier?.moving).toBe(true)
    expect(waitLine(moving.links, moving.parcel)).toEqual({ label: "in transit · waited", value: "2 years" })
    expect(narrate(moving)).toContain("On its way. Waited: 2 years.")
    expect(narrate(moving)).not.toContain("Waiting for")

    const fresh = run(withLinks("wifi"), { type: "send" })
    expect(waitLine(fresh.links, fresh.parcel)).toEqual({ label: "in transit · waited", value: "under a year" })
  })

  it("keeps the years once delivered, as time waited", () => {
    const later = run(INITIAL_STATE, { type: "send" }, { type: "wait" }, { type: "wait" })
    const delivered = run(later, { type: "toggle", link: "wifi", instant: true }, { type: "toggle", link: "radio", instant: true })
    expect(waitLine(delivered.links, delivered.parcel)).toEqual({ label: "waited", value: "2 years" })
    expect(narrate(delivered)).toContain("Your copy is released. Waited: 2 years.")
  })
})

describe("receipt views", () => {
  it("tags stations: ready, waiting here, done, not yet", () => {
    expect(stationTag(INITIAL_STATE, SENDER)).toEqual({ text: "ready", tone: "here" })
    expect(stationTag(INITIAL_STATE, HUB)).toEqual({ text: "not yet", tone: "none" })

    const atHub = run(withLinks("wifi"), { type: "send", instant: true })
    expect(stationTag(atHub, SENDER)).toEqual({ text: "sent", tone: "done" })
    expect(stationTag(atHub, HUB)).toEqual({ text: "waiting here", tone: "here" })
    expect(stationTag(atHub, 2)).toEqual({ text: "not yet", tone: "none" })

    const delivered = run(atHub, { type: "toggle", link: "radio", instant: true })
    expect(stationTag(delivered, SENDER)).toEqual({ text: "confirmed", tone: "here" })
    expect(stationTag(delivered, HUB)).toEqual({ text: "holds a sealed copy", tone: "done" })
    expect(stationTag(delivered, 2)).toEqual({ text: "repeated it", tone: "done" })
    expect(stationTag(delivered, RECIPIENT)).toEqual({ text: "acknowledged", tone: "done" })
  })

  it("shows the hop each thing is on and whether its link is on", () => {
    const moving = run(withLinks("wifi"), { type: "send" })
    expect(hopView(moving, 0)).toEqual({ label: "Wi-Fi or Bluetooth", open: true, carrying: "message" })
    expect(hopView(moving, 1)).toEqual({ label: "long-range radio", open: false, carrying: null })
  })

  it("says a relay passed it through and a station that holds keeps it sealed", () => {
    expect(STATIONS.map((s) => (s.sees ? carriedLabel(s) : null))).toEqual([null, "sealed", "passed through", "sealed", null])
  })

  it("explains what waits where", () => {
    expect(waitNote({ station: HUB, hop: 1, cargo: "message" })).toBe("the sealed message waits here for long-range radio")
    expect(waitNote({ station: 3, hop: 2, cargo: "ack" })).toBe("their acknowledgement waits here for long-range radio")
  })

  it("seals the words into deterministic block noise that grows with the message", () => {
    const a = sealedNoise("hello there")
    expect(sealedNoise("hello there")).toBe(a)
    expect(a).toMatch(/^[░▒▓█]+$/)
    expect(sealedNoise("x".repeat(60)).length).toBeGreaterThan(sealedNoise("x").length)
    expect(sealedNoise("x".repeat(100_000)).length).toBeLessThanOrEqual(40)
  })

  it("lists the five kinds of cargo on one fabric", () => {
    expect(CARGO_KINDS).toEqual(["human messages", "agent operations", "knowledge sync", "software updates", "validated patches"])
  })
})
