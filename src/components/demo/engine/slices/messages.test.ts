import { describe, expect, it } from "vitest"
import { LABEL_PATTERN } from "@/lib/labels"
import { MESSAGES_COPY, MESSAGES_SAMPLES } from "../../copy/messages"
import { NEEDS_COPY } from "../../copy/core"
import { PATHS } from "../router"
import { attentionCount, homeHubHeard, meshNeighbours, needsYou } from "../selectors"
import { createDemoStore, type DemoStore } from "../store"
import { DEMO_WORLD } from "../world"
import type { DemoState } from "./index"
import {
  canWrite,
  initialMessages,
  MESSAGE_TIMING,
  needsMessages,
  nextStep,
  openRequestCount,
  reduceMessages,
  REPLIER,
  requestPeer,
  unreadCount,
  type DemoMessage,
} from "./messages"

const T = MESSAGE_TIMING
const REQ = requestPeer(DEMO_WORLD)

function setup(path = "/messages"): DemoStore {
  return createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: path })
}

const snap = (s: DemoStore): DemoState => s.getSnapshot()
const own = (s: DemoStore, peer: string): DemoMessage[] => snap(s).messages.messages.filter((m) => m.peer === peer && m.dir === "own")
const lastOwn = (s: DemoStore, peer: string): DemoMessage => {
  const list = own(s, peer)
  return list[list.length - 1]
}
const incomingOf = (s: DemoStore, peer: string): DemoMessage[] => snap(s).messages.messages.filter((m) => m.peer === peer && m.dir === "in")
const causes = (s: DemoStore): string[] => snap(s).core.events.map((e) => e.cause)
const unread = (s: DemoStore, peer: string): number => {
  const t = snap(s).messages.threads.find((x) => x.peer === peer)
  return t ? incomingOf(s, peer).filter((m) => m.seq > t.readSeq).length : 0
}
const msgSteps = (s: DemoStore) => s.scheduler.pending().filter((p) => p.key?.startsWith("msg:"))

describe("messages slice: the opening state", () => {
  it("one welcome message from Ada sits in Messages, unread, with the welcome cause", () => {
    const s = setup()
    const welcome = incomingOf(s, REPLIER)
    expect(welcome).toHaveLength(1)
    expect(welcome[0].text).toBe(MESSAGES_SAMPLES.welcome)
    expect(welcome[0].cause).toBe("welcome")
    expect(unread(s, REPLIER)).toBe(1)
  })

  it("Bram's last message waits in the outbox with no step planned; one request is pending", () => {
    const s = setup()
    expect(lastOwn(s, "bram")).toMatchObject({ state: "queued", next: null, cancelled: false })
    const req = snap(s).messages.threads.find((t) => t.peer === REQ)
    expect(req).toMatchObject({ kind: "request", alias: null, ignored: false })
    expect(incomingOf(s, REQ)).toHaveLength(1)
  })

  it("nothing is scheduled and no event is logged while idle", () => {
    const s = setup()
    expect(s.scheduler.pending()).toEqual([])
    expect(snap(s).core.events).toEqual([])
    expect(s.scheduler.runUntilIdle()).toBe(0)
    expect(lastOwn(s, "bram").state).toBe("queued")
  })

  it("labels use only a–z and 2–7; ids come from the slice counter", () => {
    const st = initialMessages(DEMO_WORLD)
    for (const t of st.threads) expect(t.label).toMatch(LABEL_PATTERN)
    expect(st.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"])
    expect(st.messages.map((m) => m.seq)).toEqual([1, 2, 3, 4])
    expect(st.seq).toBe(4)
  })

  it("the request is one needs-you row counted by the badge", () => {
    const s = setup()
    expect(needsMessages(snap(s).messages)).toEqual([
      { key: "requests", kind: "request", label: NEEDS_COPY.requestsLabel(1), detail: NEEDS_COPY.requestsDetail, href: PATHS.messages, count: 1 },
    ])
    expect(needsYou(snap(s)).items.some((i) => i.key === "requests")).toBe(true)
    expect(attentionCount(snap(s))).toBe(1)
  })
})

describe("messages slice: sending to Ada through the home hub", () => {
  it("steps queued -> sent -> relayed -> delivered through the scheduler", () => {
    const s = setup(PATHS.conversation(REPLIER))
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "Hello Ada" })
    expect(lastOwn(s, REPLIER)).toMatchObject({ state: "queued", next: "sent", text: "Hello Ada" })
    expect(causes(s)).toEqual(["message-sent"])
    expect(snap(s).core.events[0].text).toBe(MESSAGES_COPY.queuedEvent)

    s.scheduler.advance(T.writeMs)
    expect(lastOwn(s, REPLIER).state).toBe("sent")
    s.scheduler.advance(T.custodyMs - 1)
    expect(lastOwn(s, REPLIER).state).toBe("sent")
    s.scheduler.advance(1)
    expect(lastOwn(s, REPLIER).state).toBe("relayed")
    s.scheduler.advance(T.collectMs)
    expect(lastOwn(s, REPLIER).state).toBe("delivered")
    expect(causes(s)).toEqual(["message-sent", "custody-ack", "delivered"])
  })

  it("the custody receipt blips the home hub over Wi-Fi, apart from the mesh neighbours", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x" })
    s.scheduler.advance(T.writeMs + T.custodyMs)
    const ack = snap(s).core.events.find((e) => e.cause === "custody-ack")
    expect(ack?.ref).toBe(DEMO_WORLD.homeHub)
    expect(homeHubHeard(snap(s), DEMO_WORLD)).toMatchObject({ id: DEMO_WORLD.homeHub, via: "wifi", cause: "custody-ack" })
    expect(meshNeighbours(snap(s), DEMO_WORLD)).toEqual([])
    // quiet: the slice's own custody sentence, no second "node heard" line
    expect(causes(s)).not.toContain("node-heard")
  })

  it("Ada replies a few seconds after your message reached her, with the reply cause", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x" })
    s.scheduler.advance(T.writeMs + T.custodyMs + T.collectMs)
    expect(incomingOf(s, REPLIER)).toHaveLength(1)
    s.scheduler.advance(T.replyMs)
    const replies = incomingOf(s, REPLIER)
    expect(replies).toHaveLength(2)
    expect(replies[1]).toMatchObject({ cause: "reply", text: MESSAGES_SAMPLES.adaReplies[0], dir: "in" })
    expect(replies[1].claimAt).not.toBeNull()
    const ev = snap(s).core.events.at(-1)
    expect(ev).toMatchObject({ cause: "reply", text: MESSAGES_COPY.newMessageFrom("Ada"), ref: REPLIER })
    // Elsewhere: it is unread (the welcome too, never opened).
    expect(unread(s, REPLIER)).toBe(2)
    expect(s.scheduler.pending()).toEqual([])
  })

  it("a reply that lands while her conversation is open is read at once", () => {
    const s = setup(PATHS.messages)
    s.navigate(PATHS.conversation(REPLIER))
    expect(unread(s, REPLIER)).toBe(0)
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x" })
    s.scheduler.runUntilIdle()
    expect(incomingOf(s, REPLIER)).toHaveLength(2)
    expect(unread(s, REPLIER)).toBe(0)
  })

  it("opening a conversation marks it read; a request is never marked", () => {
    const s = setup()
    expect(unread(s, REPLIER)).toBe(1)
    s.navigate(PATHS.conversation(REPLIER))
    expect(unread(s, REPLIER)).toBe(0)
    s.navigate(PATHS.conversation(REQ))
    expect(unread(s, REQ)).toBe(1)
  })

  it("reduced motion (instant) lands delivered in the same dispatch; the reply still comes later", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x", instant: true })
    expect(lastOwn(s, REPLIER)).toMatchObject({ state: "delivered", next: null })
    expect(causes(s)).toEqual(["message-sent", "custody-ack", "delivered"])
    expect(msgSteps(s)).toEqual([])
    expect(incomingOf(s, REPLIER)).toHaveLength(1)
    s.scheduler.advance(T.replyMs)
    expect(incomingOf(s, REPLIER)).toHaveLength(2)
  })

  it("no rate limit: a burst of sends all deliver, and Ada answers once", () => {
    const s = setup()
    for (let i = 0; i < 6; i++) s.dispatch({ type: "messages/send", peer: REPLIER, text: `n${i}` })
    expect(own(s, REPLIER)).toHaveLength(6)
    s.scheduler.runUntilIdle()
    expect(own(s, REPLIER).every((m) => m.state === "delivered")).toBe(true)
    expect(incomingOf(s, REPLIER).filter((m) => m.cause === "reply")).toHaveLength(1)
    // Ada answers in turn on the next message
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "again" })
    s.scheduler.runUntilIdle()
    expect(incomingOf(s, REPLIER).filter((m) => m.cause === "reply").map((m) => m.text)).toEqual(MESSAGES_SAMPLES.adaReplies.slice(0, 2))
  })

  it("no length limit: a very long message is queued whole", () => {
    const s = setup()
    const text = "long ".repeat(4000)
    s.dispatch({ type: "messages/send", peer: REPLIER, text })
    expect(lastOwn(s, REPLIER).text).toBe(text)
  })

  it("an empty draft is not sent", () => {
    const s = setup()
    const before = snap(s)
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "   \n " })
    expect(snap(s)).toBe(before)
  })

  it("ids and arrival order come from the counter, never the clock", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "a" })
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "b" })
    expect(own(s, REPLIER).map((m) => [m.id, m.seq])).toEqual([
      ["m5", 5],
      ["m6", 6],
    ])
  })
})

describe("messages slice: the path decides", () => {
  it("with the home hub unreachable a message stays queued, and moves once messaging is live again", () => {
    const s = setup()
    s.dispatch({ type: "core/serviceTransition", id: "messaging", to: "error" })
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x" })
    s.scheduler.runUntilIdle()
    expect(lastOwn(s, REPLIER)).toMatchObject({ state: "queued", next: null })
    s.dispatch({ type: "core/serviceTransition", id: "messaging", to: "starting" })
    s.scheduler.runUntilIdle()
    expect(lastOwn(s, REPLIER).state).toBe("delivered")
  })

  it("a step whose path closed before it landed leaves the message waiting", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x" })
    s.scheduler.advance(T.writeMs)
    expect(lastOwn(s, REPLIER)).toMatchObject({ state: "sent", next: "relayed" })
    s.dispatch({ type: "core/serviceTransition", id: "messaging", to: "error" })
    s.scheduler.runUntilIdle()
    expect(lastOwn(s, REPLIER)).toMatchObject({ state: "sent", next: null })
    expect(causes(s)).not.toContain("custody-ack")
  })

  it("Ada's reply waits while the hub is unreachable and arrives once it is back", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x" })
    s.scheduler.advance(T.writeMs + T.custodyMs + T.collectMs)
    s.dispatch({ type: "core/serviceTransition", id: "messaging", to: "error" })
    s.scheduler.advance(T.replyMs)
    expect(snap(s).messages.replyWaiting).toBe(true)
    expect(incomingOf(s, REPLIER)).toHaveLength(1)
    s.dispatch({ type: "core/serviceTransition", id: "messaging", to: "live" })
    expect(incomingOf(s, REPLIER)).toHaveLength(2)
    expect(snap(s).messages.replyWaiting).toBe(false)
  })

  it("Bram (hub not yours) waits with no path; a direct radio path sends and delivers without custody", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: "bram", text: "x" })
    s.scheduler.runUntilIdle()
    expect(lastOwn(s, "bram")).toMatchObject({ state: "queued", next: null })
    s.dispatch({ type: "core/heardNode", id: "bram", via: "radio", cause: "radio-ready" })
    s.scheduler.advance(T.writeMs)
    expect(own(s, "bram").map((m) => m.state)).toEqual(["sent", "sent"])
    s.scheduler.advance(T.directAckMs)
    expect(own(s, "bram").map((m) => m.state)).toEqual(["delivered", "delivered"])
    expect(causes(s)).not.toContain("custody-ack")
    // Bram does not answer.
    s.scheduler.runUntilIdle()
    expect(incomingOf(s, "bram")).toHaveLength(1)
  })

  it("a second hear of Bram does not push his pending steps back", () => {
    const s = setup()
    s.dispatch({ type: "core/heardNode", id: "bram", via: "radio", cause: "radio-ready" })
    s.scheduler.advance(T.writeMs - 100)
    s.dispatch({ type: "core/heardNode", id: "bram", via: "radio", cause: "listen-burst", quiet: true })
    s.scheduler.advance(100)
    expect(lastOwn(s, "bram").state).toBe("sent")
  })

  it("reduced motion carries over: after an instant radio set-up Bram's waiting message lands delivered at once", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    s.dispatch({ type: "core/radioAllowed", instant: true })
    s.dispatch({ type: "core/radioFlash", instant: true })
    s.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(snap(s).messages.instant).toBe(true)
    expect(lastOwn(s, "bram")).toMatchObject({ state: "delivered", next: null })
    expect(s.scheduler.pending()).toEqual([])
    // A later action that says motion is fine switches it back.
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x", instant: false })
    expect(snap(s).messages.instant).toBe(false)
    expect(lastOwn(s, REPLIER)).toMatchObject({ state: "queued", next: "sent" })
  })

  it("the radio leaving stops a delivery that needed it", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    s.dispatch({ type: "core/radioAllowed", instant: true })
    s.dispatch({ type: "core/radioFlash", instant: true })
    s.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(snap(s).core.heard.some((h) => h.id === "bram")).toBe(true)
    s.dispatch({ type: "messages/send", peer: "bram", text: "over the radio", instant: false })
    s.scheduler.advance(T.writeMs)
    expect(lastOwn(s, "bram")).toMatchObject({ state: "sent", next: "delivered", text: "over the radio" })
    s.dispatch({ type: "core/radioRemoved" })
    s.scheduler.runUntilIdle()
    expect(lastOwn(s, "bram")).toMatchObject({ state: "sent", next: null })
  })
})

describe("messages slice: the internet flushes the outbox", () => {
  it("every waiting message leaves the outbox at once with one queue-flushed event", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: "bram", text: "second" })
    s.dispatch({ type: "core/internetConnected" })
    expect(own(s, "bram").map((m) => m.state)).toEqual(["sent", "sent"])
    const flushed = snap(s).core.events.filter((e) => e.cause === "queue-flushed")
    expect(flushed).toHaveLength(1)
    expect(flushed[0].text).toBe(MESSAGES_COPY.flushedEvent(2))
    // Sent is not delivered: only Bram's node can say that.
    s.scheduler.runUntilIdle()
    expect(own(s, "bram").map((m) => m.state)).toEqual(["sent", "sent"])
  })

  it("with nothing waiting, the internet flushes nothing and says nothing", () => {
    const s = setup()
    s.dispatch({ type: "messages/cancel", id: lastOwn(s, "bram").id })
    s.dispatch({ type: "core/internetConnected" })
    expect(causes(s)).not.toContain("queue-flushed")
    expect(lastOwn(s, "bram")).toMatchObject({ state: "queued", cancelled: true })
  })

  it("a second connect does not flush again", () => {
    const s = setup()
    s.dispatch({ type: "core/internetConnected" })
    s.dispatch({ type: "core/internetLost" })
    s.dispatch({ type: "core/internetConnected" })
    expect(snap(s).core.events.filter((e) => e.cause === "queue-flushed")).toHaveLength(1)
  })

  it("after the flush Bram's node acknowledges once it is heard", () => {
    const s = setup()
    s.dispatch({ type: "core/internetConnected", instant: true })
    s.dispatch({ type: "core/heardNode", id: "bram", via: "radio", cause: "radio-ready" })
    s.scheduler.advance(T.directAckMs)
    expect(lastOwn(s, "bram").state).toBe("delivered")
  })
})

describe("messages slice: cancel", () => {
  it("cancels only an own message that is still queued; it stays queued and is never sent", () => {
    const s = setup()
    const id = lastOwn(s, "bram").id
    s.dispatch({ type: "messages/cancel", id })
    expect(lastOwn(s, "bram")).toMatchObject({ state: "queued", cancelled: true, next: null })
    s.dispatch({ type: "core/heardNode", id: "bram", via: "radio", cause: "radio-ready" })
    s.scheduler.runUntilIdle()
    expect(lastOwn(s, "bram").state).toBe("queued")
    const before = snap(s)
    s.dispatch({ type: "messages/cancel", id })
    s.dispatch({ type: "messages/cancel", id: "m1" }) // incoming
    expect(snap(s)).toBe(before)
  })

  it("a message that already left cannot be cancelled", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x" })
    s.scheduler.advance(T.writeMs)
    const before = snap(s)
    s.dispatch({ type: "messages/cancel", id: lastOwn(s, REPLIER).id })
    expect(snap(s)).toBe(before)
  })

  it("cancelling in the outbox window drops the pending step", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "x" })
    s.dispatch({ type: "messages/cancel", id: lastOwn(s, REPLIER).id })
    expect(msgSteps(s)).toEqual([])
    s.scheduler.runUntilIdle()
    expect(lastOwn(s, REPLIER)).toMatchObject({ state: "queued", cancelled: true })
  })
})

describe("messages slice: message requests", () => {
  it("a pending request cannot be written to", () => {
    const s = setup()
    const before = snap(s)
    s.dispatch({ type: "messages/send", peer: REQ, text: "hi" })
    expect(snap(s)).toBe(before)
  })

  it("ignore folds it out of the badge; show again brings it back", () => {
    const s = setup()
    s.dispatch({ type: "messages/ignoreRequest", peer: REQ })
    expect(openRequestCount(snap(s).messages)).toBe(0)
    expect(needsMessages(snap(s).messages)).toEqual([])
    expect(attentionCount(snap(s))).toBe(0)
    expect(snap(s).messages.threads.find((t) => t.peer === REQ)).toMatchObject({ kind: "request", ignored: true })
    s.dispatch({ type: "messages/restoreRequest", peer: REQ })
    expect(attentionCount(snap(s))).toBe(1)
  })

  it("accept makes a contact (held words kept) that can be written to through the hub", () => {
    const s = setup()
    s.dispatch({ type: "messages/ignoreRequest", peer: REQ })
    s.dispatch({ type: "messages/acceptRequest", peer: REQ })
    expect(snap(s).messages.threads.find((t) => t.peer === REQ)).toMatchObject({ kind: "contact", ignored: false })
    expect(incomingOf(s, REQ)).toHaveLength(1)
    expect(attentionCount(snap(s))).toBe(0)
    s.dispatch({ type: "messages/send", peer: REQ, text: "Happy to help." })
    s.scheduler.runUntilIdle()
    expect(lastOwn(s, REQ).state).toBe("delivered")
    expect(incomingOf(s, REQ)).toHaveLength(1)
  })

  it("accepting while its conversation is open marks the held words read", () => {
    const s = setup(PATHS.messages)
    s.navigate(PATHS.conversation(REQ))
    expect(unread(s, REQ)).toBe(1)
    s.dispatch({ type: "messages/acceptRequest", peer: REQ })
    expect(unread(s, REQ)).toBe(0)
  })

  it("forget discards the request and its held words; it is final for this demo", () => {
    const s = setup()
    s.dispatch({ type: "messages/forgetRequest", peer: REQ })
    expect(snap(s).messages.threads.some((t) => t.peer === REQ)).toBe(false)
    expect(snap(s).messages.messages.some((m) => m.peer === REQ)).toBe(false)
    expect(attentionCount(snap(s))).toBe(0)
    const before = snap(s)
    s.dispatch({ type: "messages/acceptRequest", peer: REQ })
    expect(snap(s)).toBe(before)
  })

  it("request actions do nothing on a contact", () => {
    const s = setup()
    const before = snap(s)
    s.dispatch({ type: "messages/ignoreRequest", peer: REPLIER })
    s.dispatch({ type: "messages/acceptRequest", peer: REPLIER })
    s.dispatch({ type: "messages/forgetRequest", peer: REPLIER })
    expect(snap(s)).toBe(before)
  })
})

describe("messages slice: the sidebar's Messages count (unread + open requests)", () => {
  const count = (s: DemoStore) => unreadCount(snap(s).messages) + openRequestCount(snap(s).messages)

  it("opens at 2: Ada's welcome (unread) and the pending request; Bram's old message is read", () => {
    const s = setup(PATHS.overview)
    expect(unreadCount(snap(s).messages)).toBe(1)
    expect(count(s)).toBe(2)
  })

  it("goes down per conversation: the Messages list alone clears nothing, opening Ada's thread clears hers", () => {
    const s = setup(PATHS.overview)
    s.navigate(PATHS.messages)
    expect(count(s)).toBe(2)
    s.navigate(PATHS.conversation(REPLIER))
    expect(count(s)).toBe(1)
  })

  it("a request stays counted until handled; accepted, its held words count as unread until opened", () => {
    const s = setup(PATHS.overview)
    s.dispatch({ type: "messages/ignoreRequest", peer: REQ })
    expect(count(s)).toBe(1)
    s.dispatch({ type: "messages/acceptRequest", peer: REQ })
    expect(count(s)).toBe(2)
    s.navigate(PATHS.conversation(REQ))
    expect(count(s)).toBe(1)
  })

  it("a reply that arrives while its conversation is closed counts; one that arrives open does not", () => {
    const s = setup(PATHS.messages)
    s.navigate(PATHS.conversation(REPLIER))
    expect(count(s)).toBe(1)
    s.dispatch({ type: "messages/send", peer: REPLIER, text: "Hello Ada." })
    s.navigate(PATHS.overview)
    s.scheduler.runUntilIdle()
    expect(incomingOf(s, REPLIER).length).toBeGreaterThan(1)
    expect(count(s)).toBe(2)

    const open = setup(PATHS.messages)
    open.navigate(PATHS.conversation(REPLIER))
    open.dispatch({ type: "messages/send", peer: REPLIER, text: "Hello Ada." })
    open.scheduler.runUntilIdle()
    expect(incomingOf(open, REPLIER).length).toBeGreaterThan(1)
    expect(count(open)).toBe(1)
  })
})

describe("messages slice: pure helpers", () => {
  const core = snap(setup()).core
  const hub = { peer: REPLIER, route: "hub" as const }
  const direct = { peer: "bram", route: "direct" as const }

  it("canWrite: the hub link, a direct path or the internet", () => {
    expect(canWrite(hub, core)).toBe(true)
    expect(canWrite(direct, core)).toBe(false)
    expect(canWrite(direct, { ...core, internet: "connected" })).toBe(true)
    const down = { ...core, services: core.services.map((x) => (x.id === "messaging" ? { ...x, state: "error" as const } : x)) }
    expect(canWrite(hub, down)).toBe(false)
  })

  it("nextStep: relayed only through the hub; a direct path skips custody; done and cancelled stop", () => {
    expect(nextStep({ dir: "own", cancelled: false, state: "queued" }, hub, core)).toEqual({ to: "sent", ms: T.writeMs })
    expect(nextStep({ dir: "own", cancelled: false, state: "sent" }, hub, core)).toEqual({ to: "relayed", ms: T.custodyMs })
    expect(nextStep({ dir: "own", cancelled: false, state: "relayed" }, hub, core)).toEqual({ to: "delivered", ms: T.collectMs })
    expect(nextStep({ dir: "own", cancelled: false, state: "delivered" }, hub, core)).toBeNull()
    expect(nextStep({ dir: "own", cancelled: true, state: "queued" }, hub, core)).toBeNull()
    expect(nextStep({ dir: "in", cancelled: false, state: "delivered" }, hub, core)).toBeNull()
    expect(nextStep({ dir: "own", cancelled: false, state: "sent" }, direct, core)).toBeNull()
    const heard = { ...core, heard: [{ id: "bram" as const, via: "radio" as const, cause: "radio-ready" as const, firstCause: "radio-ready" as const, firstAt: 0, lastAt: 0, count: 1, blip: 1 }] }
    expect(nextStep({ dir: "own", cancelled: false, state: "sent" }, direct, heard)).toEqual({ to: "delivered", ms: T.directAckMs })
  })

  it("an action the slice does not handle returns the same state", () => {
    const st = initialMessages(DEMO_WORLD)
    const s = setup()
    const ctx = {
      world: DEMO_WORLD,
      now: 0,
      prev: snap(s),
      core: snap(s).core,
      schedule: () => undefined,
      cancel: () => undefined,
      dispatch: () => undefined,
      emit: () => undefined,
      rng: () => () => 0,
    }
    expect(reduceMessages(st, { type: "core/setMode", mode: "advanced" }, ctx)).toBe(st)
    expect(reduceMessages(st, { type: "core/heardNode", id: "ridge-repeater", via: "radio", cause: "radio-ready" }, ctx)).toBe(st)
    expect(reduceMessages(st, { type: "core/navigate", path: PATHS.devices }, ctx)).toBe(st)
  })
})
