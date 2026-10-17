// Server-render smoke tests of the Messages view: it renders in node (no window), its headings follow
// the shell, and what it prints follows the store as the scheduler steps a message along.
import { createElement, type FunctionComponent, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DEMO_ACTIONS } from "../../copy/core"
import { MESSAGES_COPY, MESSAGES_REASON_COPY, MESSAGES_SAMPLES, MESSAGES_STATE_COPY } from "../../copy/messages"
import { DemoStoreProvider } from "../../engine/react"
import { parsePath, PATHS } from "../../engine/router"
import { MESSAGE_TIMING, requestPeer } from "../../engine/slices/messages"
import { createDemoStore, type DemoStore } from "../../engine/store"
import { DEMO_WORLD } from "../../engine/world"
import { ShellProvider, type ShellContextValue } from "../../shell/context"
import MessagesView from "./index"

const Provider = DemoStoreProvider as FunctionComponent<{ store: DemoStore; children?: ReactNode }>
const REQ = requestPeer(DEMO_WORLD)
const T = MESSAGE_TIMING

const shell = (embedded: boolean): ShellContextValue => ({
  mainId: "m",
  mainRef: { current: null },
  announce: () => {},
  embedded,
  headingBase: embedded ? 3 : 1,
})

/** Render the CURRENT state at `path`: on the server useDemo reads getServerSnapshot, so point it at the live one. */
function render(store: DemoStore, path: string, embedded = false): string {
  const live: DemoStore = { ...store, getServerSnapshot: store.getSnapshot }
  const view = createElement(MessagesView, { route: parsePath(path) })
  return renderToString(createElement(Provider, { store: live }, createElement(ShellProvider, { value: shell(embedded) }, view)))
}

const newStore = (path: string = PATHS.messages) => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: path })

/** Visible text without tags (and React's comment markers), entities decoded, whitespace collapsed. */
const text = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")

const count = (s: string, part: string) => s.split(part).length - 1

describe("Messages list", () => {
  it("requests first with the real note, then conversations; incoming items carry the demo note", () => {
    const html = render(newStore(), PATHS.messages)
    expect(html).toMatch(/<h1[^>]*>Messages<\/h1>/)
    const t = text(html)
    expect(t).toContain(MESSAGES_COPY.requestsHeading(1))
    expect(t).toContain(MESSAGES_COPY.requestNote)
    expect(t).toContain(MESSAGES_SAMPLES.request)
    expect(t).toContain("accept")
    expect(t).toContain("ignore")
    expect(t.indexOf("Ada")).toBeLessThan(t.indexOf("Bram"))
    expect(t).toContain("1 unread")
    expect(t).toContain(`you: ${MESSAGES_SAMPLES.bramOwn}`)
    // the request row and Ada's welcome row are incoming; Bram's last line is your own
    expect(count(t, "demo message")).toBe(2)
    expect(html).toContain(`href="/demo#/messages/ada"`)
    expect(html).not.toMatch(/href="#(?!\/)/)
    expect(html).not.toContain("messaging-banner")
  })

  it("an ignored request folds out of the count and the badge", () => {
    const s = newStore()
    s.dispatch({ type: "messages/ignoreRequest", peer: REQ })
    const t = text(render(s, PATHS.messages))
    expect(t).toContain(MESSAGES_COPY.requestsHeading(0))
    expect(t).toContain(MESSAGES_COPY.noNewRequests)
    expect(t).toContain(MESSAGES_COPY.ignoredSummary(1))
    expect(t).toContain("show again")
  })

  it("takes the shell's heading levels inside the L4 window", () => {
    const html = render(newStore(), PATHS.messages, true)
    expect(html).toMatch(/<h3[^>]*>Messages<\/h3>/)
    expect(html).toMatch(/<h4[^>]*>conversations<\/h4>/)
    expect(html).not.toMatch(/<h[12][\s>]/)
  })

  it("shows the messaging line with the agent hand-off when Messaging has a problem", () => {
    const s = newStore()
    s.dispatch({ type: "core/serviceTransition", id: "messaging", to: "error" })
    const t = text(render(s, PATHS.messages))
    expect(t).toContain(MESSAGES_COPY.banner.error)
    expect(t).toContain(MESSAGES_COPY.banner.fix)
    expect(t).toContain(MESSAGES_COPY.banner.settings)
    expect(t).toContain("ERROR")
  })
})

describe("A conversation", () => {
  it("Ada: the welcome message with its demo note, the arrival line and the composer", () => {
    const s = newStore(PATHS.conversation("ada"))
    const html = render(s, PATHS.conversation("ada"))
    expect(html).toMatch(/<h1[^>]*>Ada<\/h1>/)
    const t = text(html)
    expect(t).toContain(MESSAGES_SAMPLES.welcome)
    expect(t).toContain("demo message")
    expect(t).toContain(MESSAGES_COPY.arrived)
    expect(t).toContain(MESSAGES_COPY.unverifiedTime)
    expect(html).toContain('aria-label="Message"')
    expect(t).toContain(MESSAGES_COPY.composerNote)
    expect(html).not.toContain("maxlength")
  })

  it("a message to Ada steps queued -> sent -> relayed (custody line) -> delivered, then her reply", () => {
    const s = newStore(PATHS.conversation("ada"))
    const at = () => text(render(s, PATHS.conversation("ada")))
    s.dispatch({ type: "messages/send", peer: "ada", text: "Hello Ada" })
    expect(at()).toContain(MESSAGES_STATE_COPY.queued)
    expect(at()).toContain(MESSAGES_COPY.cancelSending)
    // On its way to a reachable hub: not "waiting for a path", so no internet demo action.
    expect(at()).not.toContain(DEMO_ACTIONS.internet)
    s.scheduler.advance(T.writeMs)
    expect(at()).toContain(MESSAGES_STATE_COPY.sent)
    s.scheduler.advance(T.custodyMs)
    expect(at()).toContain(MESSAGES_STATE_COPY.relayed)
    expect(at()).toContain(MESSAGES_COPY.custody("Workshop hub", "Ada"))
    s.scheduler.advance(T.collectMs)
    expect(at()).toContain(MESSAGES_STATE_COPY.delivered)
    expect(at()).toContain(MESSAGES_COPY.custodyDone("Workshop hub", "Ada"))
    s.scheduler.advance(T.replyMs)
    const t = at()
    expect(t).toContain(MESSAGES_SAMPLES.adaReplies[0])
    expect(count(t, "demo message")).toBe(2)
  })

  it("Bram: the real waiting reason and the contextual internet demo action, which flushes the outbox", () => {
    const s = newStore(PATHS.conversation("bram"))
    let t = text(render(s, PATHS.conversation("bram")))
    expect(t).toContain(MESSAGES_REASON_COPY.hubNotYours)
    expect(t).toContain(MESSAGES_COPY.outboxWaiting)
    expect(t).toContain(`DEMO ${DEMO_ACTIONS.internet}`)
    s.dispatch({ type: "core/internetConnected" })
    t = text(render(s, PATHS.conversation("bram")))
    expect(t).toContain(MESSAGES_REASON_COPY.hubNotYoursSent)
    expect(t).toContain(MESSAGES_STATE_COPY.sent)
    expect(t).not.toContain(DEMO_ACTIONS.internet)
  })

  it("a request conversation is read-only until accepted; then the composer appears", () => {
    const s = newStore(PATHS.conversation(REQ))
    let html = render(s, PATHS.conversation(REQ))
    let t = text(html)
    expect(t).toContain(MESSAGES_SAMPLES.request)
    expect(t).toContain(MESSAGES_COPY.requestGate)
    expect(html).not.toContain('aria-label="Message"')
    s.dispatch({ type: "messages/acceptRequest", peer: REQ })
    html = render(s, PATHS.conversation(REQ))
    t = text(html)
    expect(t).not.toContain(MESSAGES_COPY.requestGate)
    expect(html).toContain('aria-label="Message"')
  })

  it("an unknown id is an honest not-found", () => {
    const t = text(render(newStore(), PATHS.conversation("nobody")))
    expect(t).toContain(MESSAGES_COPY.notFoundTitle)
    expect(t).toContain(MESSAGES_COPY.notFoundBody)
    expect(t).toContain(MESSAGES_COPY.allMessages)
  })

  it("advanced mode adds the label line and the evidence names", () => {
    const s = newStore(PATHS.conversation("bram"))
    s.dispatch({ type: "core/setMode", mode: "advanced" })
    const t = text(render(s, PATHS.conversation("bram")))
    expect(t).toContain(MESSAGES_COPY.labelLine(DEMO_WORLD.cast.find((c) => c.id === "bram")?.label ?? ""))
    expect(t).toContain(MESSAGES_COPY.evidence.queued)
  })
})
