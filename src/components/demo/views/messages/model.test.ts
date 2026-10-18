import { describe, expect, it } from "vitest"
import { MESSAGES_COPY, MESSAGES_REASON_COPY, MESSAGES_SAMPLES, MESSAGES_STATE_COPY } from "../../copy/messages"
import { DAY, HOUR, MIN } from "../../engine/clock"
import { initialMessages, requestPeer, type DemoMessage, type DemoThread, type MessagesState } from "../../engine/slices/messages"
import { DEMO_WORLD } from "../../engine/world"
import {
  claimText,
  composeGate,
  conversationSummaries,
  custodyLine,
  draftProblem,
  evidenceText,
  glyphFor,
  isCancellable,
  lastLine,
  messageStateCopy,
  messagingBanner,
  oneLine,
  reasonText,
  requestItems,
  stateCopy,
  summarize,
  timeLabel,
  unresolved,
  waitingInOutbox,
  whenText,
} from "./model"

const REQ = requestPeer(DEMO_WORLD)
const base = initialMessages(DEMO_WORLD)

const own = (state: DemoMessage["state"], extra: Partial<DemoMessage> = {}): DemoMessage => ({
  id: "m9",
  peer: "ada",
  dir: "own",
  text: "x",
  at: 0,
  seq: 9,
  state,
  cancelled: false,
  next: null,
  claimAt: null,
  cause: null,
  ...extra,
})

const ada = base.threads.find((t) => t.peer === "ada") as DemoThread
const bram = base.threads.find((t) => t.peer === "bram") as DemoThread

describe("delivery evidence", () => {
  it("the four state sentences are the real dashboard's, verbatim", () => {
    // os/40-interface/ui/src/views/messages/model.ts STATE_COPY
    expect(MESSAGES_STATE_COPY).toEqual({
      queued: "In the outbox on this node: there is no path to them yet, their key is missing, or their hub is not yours.",
      sent: "A frame was written to a link. They have not confirmed it yet.",
      relayed: "A mailbox node saved it and will hold it for them.",
      delivered: "Their node acknowledged it. Only that acknowledgement says delivered.",
    })
    for (const s of ["queued", "sent", "relayed", "delivered"] as const) expect(stateCopy(s)).toBe(MESSAGES_STATE_COPY[s])
  })

  it("the reasons are the real (state, code) sentences, verbatim; no invented codes", () => {
    expect(MESSAGES_REASON_COPY).toEqual({
      hubNotYours: "Their hub is not yours; it is delivered when you meet directly.",
      hubNotYoursSent: "Your hub does not know them, so it cannot hold this for them. Your copy is kept here; it is delivered when you meet directly.",
      cancelled: "You cancelled this before it left. Its words are not sent; an empty placeholder goes in their place so no message number is skipped.",
    })
  })

  it("glyph: pips filled as far as the evidence got", () => {
    expect(glyphFor("queued")).toEqual({ filled: 0, label: "queued" })
    expect(glyphFor("sent")).toEqual({ filled: 1, label: "sent" })
    expect(glyphFor("relayed")).toEqual({ filled: 2, label: "relayed" })
    expect(glyphFor("delivered")).toEqual({ filled: 3, label: "delivered" })
  })

  it("a cancelled message says it is cancelled, never 'in the outbox'", () => {
    expect(messageStateCopy({ state: "queued", cancelled: true })).toBe(MESSAGES_COPY.cancelledState)
    expect(messageStateCopy({ state: "queued", cancelled: false })).toBe(MESSAGES_STATE_COPY.queued)
  })

  it("reason: cancelled, or a hub that is not yours while queued / sent; nothing else", () => {
    expect(reasonText(own("queued", { cancelled: true }), "hub")).toBe(MESSAGES_REASON_COPY.cancelled)
    expect(reasonText(own("queued"), "direct")).toBe(MESSAGES_REASON_COPY.hubNotYours)
    expect(reasonText(own("sent"), "direct")).toBe(MESSAGES_REASON_COPY.hubNotYoursSent)
    expect(reasonText(own("delivered"), "direct")).toBeNull()
    expect(reasonText(own("queued"), "hub")).toBeNull()
    expect(reasonText(own("relayed"), "hub")).toBeNull()
    expect(reasonText({ dir: "in", state: "delivered", cancelled: false }, "direct")).toBeNull()
  })

  it("custody line: only through your home hub, while it holds the copy and once it was collected", () => {
    expect(custodyLine(own("relayed"), ada, DEMO_WORLD)).toBe(MESSAGES_COPY.custody("Workshop hub", "Ada"))
    expect(custodyLine(own("delivered"), ada, DEMO_WORLD)).toBe(MESSAGES_COPY.custodyDone("Workshop hub", "Ada"))
    expect(custodyLine(own("relayed"), ada, DEMO_WORLD)).toContain("It cannot read it.")
    for (const s of ["queued", "sent"] as const) expect(custodyLine(own(s), ada, DEMO_WORLD)).toBeNull()
    expect(custodyLine(own("delivered"), bram, DEMO_WORLD)).toBeNull()
    expect(custodyLine(own("relayed", { cancelled: true }), ada, DEMO_WORLD)).toBeNull()
    expect(custodyLine({ dir: "in", state: "delivered", cancelled: false }, ada, DEMO_WORLD)).toBeNull()
  })

  it("evidence in plain words, by state", () => {
    expect(evidenceText({ dir: "in", state: "delivered", cancelled: false })).toBe(MESSAGES_COPY.evidence.in)
    expect(evidenceText(own("queued", { cancelled: true }))).toBe(MESSAGES_COPY.evidence.cancelled)
    expect(evidenceText(own("relayed"))).toBe(MESSAGES_COPY.evidence.relayed)
  })

  it("only an own queued message that is not cancelled can be cancelled", () => {
    expect(isCancellable(own("queued"))).toBe(true)
    expect(isCancellable(own("sent"))).toBe(false)
    expect(isCancellable(own("queued", { cancelled: true }))).toBe(false)
    expect(isCancellable({ dir: "in", state: "queued", cancelled: false })).toBe(false)
    expect(waitingInOutbox([own("queued"), own("queued", { cancelled: true }), own("sent")])).toBe(1)
    // in its outbox window with a step planned: not waiting for a path
    expect(waitingInOutbox([own("queued", { next: "sent" })])).toBe(0)
  })
})

describe("lines and summaries", () => {
  it("one line: whitespace flattened, long text cut with an ellipsis", () => {
    expect(oneLine("a\n\n b  c")).toBe("a b c")
    const cut = oneLine("word ".repeat(40))
    expect(cut.length).toBeLessThanOrEqual(80)
    expect(cut.endsWith("…")).toBe(true)
  })

  it("last line: 'you: …' for own, the text for incoming, a quiet word when empty", () => {
    expect(lastLine(null)).toBe(MESSAGES_COPY.noMessagesYet)
    expect(lastLine({ dir: "own", text: "hi" })).toBe("you: hi")
    expect(lastLine({ dir: "in", text: "hi" })).toBe("hi")
  })

  it("unresolved counts what is still on its way", () => {
    expect(unresolved({ queued: 2, sent: 1, relayed: 0 })).toBe("2 queued · 1 sent")
    expect(unresolved({ queued: 0, sent: 0, relayed: 0 })).toBe("")
  })

  it("conversations: newest activity first by arrival order; the request is not a conversation", () => {
    const list = conversationSummaries(base)
    expect(list.map((s) => s.thread.peer)).toEqual(["ada", "bram"])
    const [a, b] = list
    expect(a).toMatchObject({ name: "Ada", unread: 1, glyph: null })
    expect(a.last?.text).toBe(MESSAGES_SAMPLES.welcome)
    expect(b).toMatchObject({ name: "Bram", unread: 0, states: { queued: 1, sent: 0, relayed: 0 } })
    expect(b.glyph?.state).toBe("queued")
  })

  it("an accepted request becomes a conversation named by its label; cancelled messages are not waiting", () => {
    const accepted: MessagesState = {
      ...base,
      threads: base.threads.map((t) => (t.peer === REQ ? { ...t, kind: "contact" as const } : t)),
      messages: base.messages.map((m) => (m.peer === "bram" && m.dir === "own" ? { ...m, cancelled: true } : m)),
    }
    const list = conversationSummaries(accepted)
    expect(list.map((s) => s.thread.peer)).toEqual(["ada", REQ, "bram"])
    expect(list[1].name).toBe(REQ)
    expect(list[2].states.queued).toBe(0)
  })

  it("a request is never counted unread", () => {
    const req = base.threads.find((t) => t.peer === REQ) as DemoThread
    expect(summarize(req, base.messages).unread).toBe(0)
  })

  it("request items: label, held words as a preview, the ignore fold", () => {
    expect(requestItems(base)).toEqual([{ peer: REQ, label: REQ, preview: MESSAGES_SAMPLES.request, ignored: false }])
    const ignored = { ...base, threads: base.threads.map((t) => (t.peer === REQ ? { ...t, ignored: true } : t)) }
    expect(requestItems(ignored)[0].ignored).toBe(true)
    const empty = { ...base, messages: base.messages.filter((m) => m.peer !== REQ) }
    expect(requestItems(empty)[0].preview).toBe(MESSAGES_COPY.noHeldMessage)
  })
})

describe("time, composer, banner", () => {
  it("when: the clock today, the day and clock otherwise", () => {
    expect(whenText(-3 * MIN, 0)).toBe("08:57")
    expect(whenText(-DAY + 3 * HOUR, 0)).toBe("16 Oct 12:00")
  })

  it("the sender's claim is kept apart and only for incoming messages", () => {
    const m = base.messages.find((x) => x.peer === "ada") as DemoMessage
    expect(claimText(m, 0)).toBe(MESSAGES_COPY.claim(whenText(m.claimAt as number, 0)))
    expect(claimText(own("sent"), 0)).toBeNull()
    expect(timeLabel(m)).toBe(MESSAGES_COPY.received)
    expect(timeLabel(own("sent"))).toBe(MESSAGES_COPY.written)
  })

  it("no length limit: only an empty draft is refused", () => {
    expect(draftProblem("  \n")).toBe(MESSAGES_COPY.writeFirst)
    expect(draftProblem("x".repeat(100_000))).toBeNull()
  })

  it("a pending request is read-only until accepted", () => {
    expect(composeGate({ kind: "contact" })).toEqual({ ok: true })
    expect(composeGate({ kind: "request" })).toEqual({ ok: false, why: MESSAGES_COPY.requestGate })
  })

  it("the messaging line: none while live; fix on error, set up when not set, no button while starting", () => {
    expect(messagingBanner({ state: "live", reason: "ok" })).toBeNull()
    expect(messagingBanner(null)).toBeNull()
    expect(messagingBanner({ state: "error", reason: "The message store could not be opened." })).toMatchObject({
      kind: "error",
      text: "The message store could not be opened.",
      agent: { label: MESSAGES_COPY.banner.fix, primary: false },
    })
    expect(messagingBanner({ state: "unset", reason: "" })).toMatchObject({ text: MESSAGES_COPY.banner.unsetFallback, agent: { label: MESSAGES_COPY.banner.setup, primary: true } })
    expect(messagingBanner({ state: "starting", reason: "" })?.agent).toBeNull()
  })
})

describe("copy honesty", () => {
  const strings = (v: unknown): string[] =>
    typeof v === "string" ? [v] : typeof v === "function" ? [String((v as (x: unknown) => string)("x"))] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []
  const all = [...strings(MESSAGES_COPY), ...strings(MESSAGES_SAMPLES), ...strings(MESSAGES_STATE_COPY), ...strings(MESSAGES_REASON_COPY)]

  it("no pair codes, lockouts, expiry, rate limits or character ceilings", () => {
    for (const s of all) expect(s).not.toMatch(/pair(ing)?[ -]?code|lock ?out|lockout|expir|rate limit|characters|attempts/i)
  })

  it("the one limit the composer names is that there is none", () => {
    expect(MESSAGES_COPY.composerNote).toContain("no length limit")
  })
})
