// The Agent slice (plan §6.3 "Canned chat", §6.4): the ordered intent table, at most four real tool
// lines per reply, word-by-word streaming through the scheduler (whole under reduced motion), the
// fallback with the starters, proposals with Accept -> STARTING -> LIVE everywhere, the prefill that
// is never sent, stop, new conversation and the queue while the agent cannot answer.
import { describe, expect, it } from "vitest"
import { LABEL_PATTERN } from "@/lib/labels"
import { AGENT_COPY, AGENT_REPLY, AGENT_STARTERS, AGENT_TOOLS } from "../../copy/agent"
import { OVERVIEW_COPY } from "../../copy/overview"
import { handoffPrompt } from "../../shell/service-page"
import { TIMING } from "../core"
import { attentionCount, needsYou, openProposals, serviceById } from "../selectors"
import { createDemoStore, type DemoStore } from "../store"
import { DEMO_WORLD } from "../world"
import {
  AGENT_STREAM_KEY,
  AGENT_TIMING,
  agentStateOf,
  conversationLabel,
  initialAgent,
  joinList,
  liveText,
  matchIntent,
  MAX_TOOL_LINES,
  proposalBlocked,
  replyFor,
  tokenize,
  type AgentIntent,
} from "./agent"

const newStore = (): DemoStore => {
  const store = createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/" })
  store.start()
  return store
}

const agent = (store: DemoStore) => store.getSnapshot().agent
const core = (store: DemoStore) => store.getSnapshot().core
const lastRow = (store: DemoStore) => agent(store).rows[agent(store).rows.length - 1]

/** Plug in, allow, flash and set the region, all instantly: the radio is LIVE, the first nodes heard. */
function radioLive(store: DemoStore): void {
  store.dispatch({ type: "core/radioPlugged" })
  store.dispatch({ type: "core/radioAllowed", instant: true })
  store.dispatch({ type: "core/radioFlash", instant: true })
  store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
  store.scheduler.runUntilIdle()
}

/** Send and let the reply stream to its end. */
function ask(store: DemoStore, text: string, instant = false): void {
  store.dispatch({ type: "agent/send", text, instant })
  store.scheduler.runUntilIdle()
}

const TOOL_LINES: readonly string[] = Object.values(AGENT_TOOLS)

describe("agent: the intent table", () => {
  it("the four starters each hit their own intent, in the plan's order", () => {
    expect(AGENT_STARTERS.map((s) => s.label)).toEqual(["check this node", "set up my radio", "why is the radio quiet?", "what can this device run?"])
    const intents = AGENT_STARTERS.flatMap((s) => [matchIntent(s.label), matchIntent(s.text)])
    expect(intents).toEqual(["check", "check", "radio", "radio", "quiet", "quiet", "device", "device"])
  })

  it("the prompts other pages prepare land on a real intent, never the fallback", () => {
    const cases: [string, AgentIntent][] = [
      [OVERVIEW_COPY.ask.checkPrompt, "check"],
      [handoffPrompt("setup", "radio"), "radio"],
      [handoffPrompt("setup", "bridge"), "setup"],
      [handoffPrompt("fix", "mesh"), "fix"],
      [handoffPrompt("fix", "radio"), "fix"],
      ["About Layer 6 (Transport): what is its state on this node and what should I configure?", "layer"],
      [AGENT_COPY.whyPrompt("Restart the mesh link"), "why"],
      ["who is nearby?", "quiet"],
    ]
    for (const [text, intent] of cases) expect({ text, intent: matchIntent(text) }).toEqual({ text, intent })
  })

  it("unknown input gets the fallback sentence and the starters, with no tool lines", () => {
    for (const text of ["hello", "tell me a joke", "?"]) {
      const r = replyFor(text, core(newStore()), DEMO_WORLD, "agent-p1")
      expect(r).toMatchObject({ intent: "fallback", text: "This is a demo, I only know a few questions. Try one of these:", starters: true, proposal: null })
      expect(r.tools).toEqual([])
    }
  })

  it("every reply uses at most four tool lines, only real tool kinds, in every state", () => {
    const texts = [...AGENT_STARTERS.map((s) => s.text), handoffPrompt("setup", "bridge"), handoffPrompt("fix", "mesh"), "About Layer 3 (Intelligence): what?", "set up", "fix it", AGENT_COPY.whyPrompt("x")]
    const store = newStore()
    const states = [core(store)]
    store.dispatch({ type: "core/serviceTransition", id: "mesh", to: "error" })
    states.push(core(store))
    radioLive(store)
    states.push(core(store))
    for (const c of states) {
      for (const text of texts) {
        const r = replyFor(text, c, DEMO_WORLD, "agent-p1")
        expect(r.tools.length).toBeLessThanOrEqual(MAX_TOOL_LINES)
        expect(new Set(r.tools).size).toBe(r.tools.length)
        for (const k of r.tools) expect(TOOL_LINES).toContain(AGENT_TOOLS[k])
        expect(r.text.trim()).not.toBe("")
        // A proposal is announced as written only with the "writing a proposal" tool line.
        expect(r.tools.includes("proposal")).toBe(r.proposal !== null)
      }
    }
  })
})

describe("agent: streaming through the scheduler", () => {
  it("shows the tool lines one by one, then the words one by one, then commits the reply", () => {
    const store = newStore()
    store.dispatch({ type: "agent/send", text: "What can this device run?" })
    const a = agent(store)
    expect(a.rows.map((r) => [r.role, r.text])).toEqual([["user", "What can this device run?"]])
    expect(a.live).not.toBeNull()
    expect(a.live?.tools).toEqual(["[reading knowledge]", "[checking health]"])
    expect([a.live?.toolsShown, a.live?.shown]).toEqual([0, 0])
    expect(store.scheduler.pending().some((t) => t.key === AGENT_STREAM_KEY)).toBe(true)

    store.scheduler.advance(AGENT_TIMING.toolMs)
    expect([agent(store).live?.toolsShown, agent(store).live?.shown]).toEqual([1, 0])
    store.scheduler.advance(AGENT_TIMING.toolMs)
    expect([agent(store).live?.toolsShown, agent(store).live?.shown]).toEqual([2, 0])
    store.scheduler.advance(AGENT_TIMING.toolMs)
    expect(agent(store).live?.shown).toBe(1)
    store.scheduler.advance(AGENT_TIMING.wordMs)
    expect(agent(store).live?.shown).toBe(2)
    const partial = liveText(agent(store).live ?? { words: [], shown: 0 })
    expect(partial.split(/\s+/).filter(Boolean)).toHaveLength(2)

    store.scheduler.runUntilIdle()
    expect(agent(store).live).toBeNull()
    expect(lastRow(store)).toMatchObject({ role: "assistant", stopped: false, tools: ["[reading knowledge]", "[checking health]"] })
    expect(lastRow(store).text).toContain("This node is a laptop with")
  })

  it("a streamed word changes only the agent slice: core and every other slice keep their identity", () => {
    const store = newStore()
    store.dispatch({ type: "agent/send", text: "check this node" })
    store.scheduler.advance(AGENT_TIMING.toolMs * 3)
    const before = store.getSnapshot()
    store.scheduler.advance(AGENT_TIMING.wordMs)
    const after = store.getSnapshot()
    expect(after.agent).not.toBe(before.agent)
    for (const k of Object.keys(after) as (keyof typeof after)[]) if (k !== "agent") expect(after[k]).toBe(before[k])
  })

  it("under reduced motion the whole reply lands in the same dispatch, with nothing scheduled", () => {
    const store = newStore()
    store.dispatch({ type: "agent/send", text: "why is the radio quiet?", instant: true })
    expect(agent(store).live).toBeNull()
    expect(lastRow(store).role).toBe("assistant")
    expect(lastRow(store).text.trim()).toBe(replyFor("why is the radio quiet?", core(store), DEMO_WORLD, "agent-p1").text)
    expect(lastRow(store).tools).toHaveLength(3)
    expect(store.scheduler.pending().some((t) => t.key === AGENT_STREAM_KEY)).toBe(false)
  })

  it("ignores an empty message and a second send while a reply streams", () => {
    const store = newStore()
    const s0 = agent(store)
    store.dispatch({ type: "agent/send", text: "   " })
    expect(agent(store)).toBe(s0)
    store.dispatch({ type: "agent/send", text: "check this node" })
    const s1 = agent(store)
    store.dispatch({ type: "agent/send", text: "hello" })
    expect(agent(store)).toBe(s1)
  })

  it("stop keeps what arrived, marks it stopped, cancels the stream and writes no proposal", () => {
    const store = newStore()
    radioLive(store)
    store.dispatch({ type: "agent/send", text: "set up my radio" })
    // Three tool lines, the pause before the first word, then two more words.
    store.scheduler.advance(AGENT_TIMING.toolMs * 4 + AGENT_TIMING.wordMs * 2)
    store.dispatch({ type: "agent/stop" })
    expect(agent(store).live).toBeNull()
    expect(lastRow(store)).toMatchObject({ role: "assistant", stopped: true })
    expect(lastRow(store).text.split(/\s+/).filter(Boolean)).toHaveLength(3)
    const frozen = store.getSnapshot()
    store.scheduler.runUntilIdle()
    expect(store.getSnapshot().agent).toBe(frozen.agent)
    expect(openProposals(store.getSnapshot())).toHaveLength(0)
  })

  it("the fallback reply carries the starters", () => {
    const store = newStore()
    ask(store, "sing me a song")
    expect(lastRow(store)).toMatchObject({ role: "assistant", text: AGENT_COPY.fallback, starters: true, tools: [] })
  })
})

describe("agent: proposals", () => {
  it("'set up my radio' before a board explains the steps and writes nothing it cannot carry out", () => {
    const store = newStore()
    ask(store, "set up my radio")
    expect(lastRow(store).text).toBe(AGENT_REPLY.radio.noBoard)
    expect(openProposals(store.getSnapshot())).toHaveLength(0)
  })

  it("with the radio live it proposes the bridge; Accept moves it STARTING -> LIVE and the badge everywhere", () => {
    const store = newStore()
    radioLive(store)
    const badge = attentionCount(store.getSnapshot())
    ask(store, "set up my radio")
    expect(lastRow(store).text).toContain(AGENT_REPLY.radio.bridgeWrote)
    expect(lastRow(store).tools).toContain("[writing a proposal]")
    const [p] = openProposals(store.getSnapshot())
    expect(p).toMatchObject({ id: "agent-p1", kind: "setup", target: "bridge", from: "agent" })
    expect(p.body).toContain("Nothing is discarded by policy; a full buffer refuses new frames until space frees, and the sender retries.")
    expect(attentionCount(store.getSnapshot())).toBe(badge + 1)
    expect(needsYou(store.getSnapshot()).items.some((i) => i.key === "proposal:agent-p1")).toBe(true)
    expect(proposalBlocked(core(store), DEMO_WORLD, p)).toBeNull()

    store.dispatch({ type: "core/proposalAccepted", id: p.id })
    expect(serviceById(store.getSnapshot(), "bridge")?.state).toBe("starting")
    expect(attentionCount(store.getSnapshot())).toBe(badge)
    expect(openProposals(store.getSnapshot())).toHaveLength(0)
    expect(lastRow(store)).toMatchObject({ role: "note", text: "You accepted: Start the bridge between long-range radio and Wi-Fi", target: "bridge" })
    store.scheduler.advance(TIMING.startingMs)
    expect(serviceById(store.getSnapshot(), "bridge")?.state).toBe("live")

    ask(store, "set up my radio")
    expect(lastRow(store).text).toContain(AGENT_REPLY.radio.bridgeLive)
    expect(openProposals(store.getSnapshot())).toHaveLength(0)
  })

  it("never writes a second proposal for a target that already has an open one", () => {
    const store = newStore()
    radioLive(store)
    ask(store, "set up my radio")
    ask(store, "Set up the bridge on this node and test it.")
    expect(openProposals(store.getSnapshot())).toHaveLength(1)
    expect(lastRow(store).text).toContain(AGENT_REPLY.radio.bridgeWaiting)
    expect(lastRow(store).tools).not.toContain("[writing a proposal]")
  })

  it("'check this node' with a service in error writes a fix; Accept brings it back LIVE", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "mesh", to: "error" })
    ask(store, "check this node")
    expect(lastRow(store).text).toContain("Mesh link has a problem: The mesh link stopped answering.")
    const [p] = openProposals(store.getSnapshot())
    expect(p).toMatchObject({ kind: "fix", target: "mesh", title: "Restart the mesh link" })
    store.dispatch({ type: "core/proposalAccepted", id: p.id, instant: true })
    expect(serviceById(store.getSnapshot(), "mesh")?.state).toBe("live")
  })

  it("Dismiss is final and leaves a note; 'Why?' explains a proposal from its own body", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "storage", to: "error" })
    ask(store, "fix the local store")
    const [p] = openProposals(store.getSnapshot())
    ask(store, AGENT_COPY.whyPrompt(p.title))
    expect(lastRow(store).text).toContain(p.body.split("\n\n")[0])
    expect(lastRow(store).text).toContain(AGENT_REPLY.why.tail)
    store.dispatch({ type: "core/proposalDismissed", id: p.id })
    expect(lastRow(store)).toMatchObject({ role: "note", text: `You dismissed: ${p.title}`, target: null })
    expect(serviceById(store.getSnapshot(), "storage")?.state).toBe("error")
  })

  it("proposalBlocked gives the target's reason while it cannot start", () => {
    const store = newStore()
    store.dispatch({ type: "core/proposalAdded", proposal: { id: "x1", kind: "setup", title: "Set up the radio", body: "b", target: "radio" } })
    const p = openProposals(store.getSnapshot())[0]
    expect(proposalBlocked(core(store), DEMO_WORLD, p)).toBe("Needs a radio board.")
  })
})

describe("agent: honest replies", () => {
  it("'why is the radio quiet?' follows the board, and calls the relay a relay that cannot read", () => {
    const store = newStore()
    ask(store, "why is the radio quiet?")
    expect(lastRow(store).text).toContain("no radio board yet")
    expect(lastRow(store).text).toContain("tried Network A, Network B and Network C in order")
    radioLive(store)
    ask(store, "why is the radio quiet?")
    expect(lastRow(store).text).toContain("It is not quiet any more")
    expect(lastRow(store).text).toContain("Ridge repeater is a relay: it forwards sealed traffic; it cannot read it.")
  })

  it("'what can this device run?' says it bridges only under the bootstrap rule, and offloads only over Wi-Fi or a cable", () => {
    const store = newStore()
    ask(store, "what can this device run?")
    expect(lastRow(store).text).not.toContain("also bridges radio and Wi-Fi")
    expect(lastRow(store).text).toContain("never over a long-range relay")
    radioLive(store)
    ask(store, "what can this device run?")
    expect(lastRow(store).text).toContain("also bridges radio and Wi-Fi")
  })

  it("a layer question reads the layer's description and its services' states", () => {
    const store = newStore()
    ask(store, "About Layer 6 (Transport): what is its state on this node and what should I configure?")
    const t = lastRow(store).text
    expect(t).toContain("Layer 6, Transport:")
    expect(t).toContain("Mesh link is running; Long-range radio is not set up yet; Bridge is not set up yet")
    expect(t).toContain("Ask me to set up the long-range radio")
  })
})

describe("agent: prefill, draft, queue and conversations", () => {
  it("a prepared prompt lands in the message box with its banner and is never sent", () => {
    const store = newStore()
    store.dispatch({ type: "core/agentPrefill", text: "Set up the bridge on this node and test it.", from: "Bridge" })
    const a = agent(store)
    expect(a.draft).toBe("Set up the bridge on this node and test it.")
    expect(a.prepared).toEqual({ from: "Bridge", text: "Set up the bridge on this node and test it." })
    expect(a.staged).toBe(1)
    store.dispatch({ type: "core/prefillTaken" })
    store.scheduler.runUntilIdle()
    expect(agent(store).rows).toHaveLength(0)
    expect(agent(store).draft).toBe("Set up the bridge on this node and test it.")
    store.dispatch({ type: "agent/send", text: agent(store).draft, instant: true })
    expect(agent(store)).toMatchObject({ draft: "", prepared: null })
    expect(agent(store).rows).toHaveLength(2)
  })

  it("typing keeps the draft; the same text is a no-op; a starter stages without sending", () => {
    const store = newStore()
    store.dispatch({ type: "agent/draft", text: "hel" })
    const s = agent(store)
    store.dispatch({ type: "agent/draft", text: "hel" })
    expect(agent(store)).toBe(s)
    store.dispatch({ type: "agent/stage", text: AGENT_STARTERS[0].text })
    expect(agent(store)).toMatchObject({ draft: AGENT_STARTERS[0].text, staged: 1, rows: [] })
  })

  it("queues while the agent cannot answer, says why, and sends once it is back", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "agent", to: "error" })
    expect(agentStateOf(core(store).services)).toMatchObject({ kind: "unavailable", canSend: false, label: "unavailable" })
    store.dispatch({ type: "agent/send", text: "check this node" })
    expect(agent(store).queued.map((q) => q.text)).toEqual(["check this node"])
    expect(agent(store).notice).toBe("The agent is unavailable: The agent stopped answering health checks. Your message is queued and sends when it is back.")
    expect(agent(store).rows).toHaveLength(0)
    store.dispatch({ type: "core/serviceTransition", id: "agent", to: "starting" })
    expect(agent(store).queued).toHaveLength(1)
    store.scheduler.advance(TIMING.startingMs)
    expect(agent(store).queued).toHaveLength(0)
    expect(agent(store).notice).toBeNull()
    expect(agent(store).live).not.toBeNull()
    store.scheduler.runUntilIdle()
    expect(lastRow(store).role).toBe("assistant")
  })

  it("a queued message can be removed", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "model", to: "starting", liveAfterMs: 10_000 })
    store.dispatch({ type: "agent/send", text: "hello" })
    expect(agent(store).notice).toBe(AGENT_COPY.queuedNotice.starting)
    store.dispatch({ type: "agent/removeQueued", id: agent(store).queued[0].id })
    expect(agent(store)).toMatchObject({ queued: [], notice: null })
  })

  it("a new conversation drops the transcript and the stream, and gets a new a–z2–7 label", () => {
    const store = newStore()
    ask(store, "check this node")
    store.dispatch({ type: "agent/send", text: "hello" })
    store.dispatch({ type: "agent/newConversation" })
    expect(agent(store)).toMatchObject({ rows: [], live: null, queued: [], conversation: 2 })
    expect(store.scheduler.pending().some((t) => t.key === AGENT_STREAM_KEY)).toBe(false)
    const a = conversationLabel(DEMO_WORLD, 1)
    const b = conversationLabel(DEMO_WORLD, 2)
    expect(a).toMatch(LABEL_PATTERN)
    expect(b).toMatch(LABEL_PATTERN)
    expect(a).not.toBe(b)
  })

  it("starts empty; helpers", () => {
    expect(initialAgent()).toMatchObject({ rows: [], live: null, draft: "", conversation: 1 })
    expect(tokenize("a b\n\nc")).toEqual(["a ", "b\n\n", "c"])
    expect([joinList([]), joinList(["a"]), joinList(["a", "b"]), joinList(["a", "b", "c"])]).toEqual(["", "a", "a and b", "a, b and c"])
  })
})
