// Overview's rules (plan §6.4 row 1, real views/overview + lib/verdict.ts + lib/attention.ts),
// driven through a memory store and the scheduler, plus the pure helpers of ./model.
import { describe, expect, it } from "vitest"
import { OVERVIEW_COPY } from "../../copy/overview"
import { HOUR, MIN, SEC } from "../../engine/clock"
import { TIMING } from "../../engine/core"
import { PATHS } from "../../engine/router"
import {
  attentionCount,
  attentionHref,
  homeHubHeard,
  meshNeighbours,
  nearbySentence,
  needsYou,
  ownDevice,
  verdict,
} from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import { createDemoStore, type DemoStore } from "../../engine/store"
import type { DemoEvent, NeedItem } from "../../engine/types"
import { DEMO_WORLD } from "../../engine/world"
import { LABEL_PATTERN } from "@/lib/labels"
import {
  activityLine,
  activityLines,
  checklistPending,
  checklistSummary,
  deviceText,
  gatewayText,
  homeHubLine,
  nearbyRows,
  needRows,
  nodeFacts,
  nodeStartedAt,
  overviewChecklist,
  SAMPLE_LAST_CHECK,
  setupTargetOf,
  updateFacts,
} from "./model"

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })

/** Overview's rows from core (setup, proposals, errors); other slices (message requests) add their own. */
const rowsOf = (s: DemoState) => needRows(needsYou(s).items, s.core.services).filter((r) => r.key !== "requests")
/** What the other slices add to the header badge (message requests), so counts here stay relative to it. */
const othersCount = (s: DemoState) => needsYou(s).items.filter((i) => i.kind === "request").reduce((n, i) => n + i.count, 0)
const checklistOf = (s: DemoState) => overviewChecklist(needsYou(s).checklist)

/** The whole radio setup, each step cut to its end state (reduced motion). */
function setUpRadio(store: DemoStore) {
  store.dispatch({ type: "core/radioPlugged" })
  store.dispatch({ type: "core/radioAllowed", instant: true })
  store.dispatch({ type: "core/radioFlash", instant: true })
  store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
}

const factsOf = (store: DemoStore) => {
  const s = store.getSnapshot()
  return nodeFacts({
    own: ownDevice(s, store.world),
    services: s.core.services,
    events: s.core.events,
    now: s.core.now,
    world: store.world,
    version: "V.test",
  })
}

describe("verdict (real lib/verdict.ts rules)", () => {
  it("opens alone on the mesh", () => {
    const s = newStore().getSnapshot()
    expect(verdict(s).sentence).toBe("Your node is running. It is alone on the mesh right now: no nearby nodes heard.")
    expect(nearbySentence(s)).toBe("No nearby nodes heard yet. This node is alone on the mesh right now.")
  })

  it("the home hub's custody ack over Wi-Fi is the home link: it never makes the node 'connected to nearby nodes'", () => {
    const store = newStore()
    store.dispatch({ type: "core/heardNode", id: "workshop-hub", via: "wifi", cause: "custody-ack", quiet: true })
    const s = store.getSnapshot()
    expect(verdict(s).sentence).toBe("Your node is running. It is alone on the mesh right now: no nearby nodes heard.")
    expect(nearbyRows(meshNeighbours(s, store.world), store.world)).toEqual([])
    expect(homeHubLine(homeHubHeard(s, store.world), store.world)).toBe(
      "Workshop hub, your home hub, answered over this Wi-Fi. That is the home link, not a nearby node on the mesh.",
    )
  })

  it("says 'connected to nearby nodes' only once the transport is joined, with the first node heard in the same moment", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed" })
    store.scheduler.advance(TIMING.identifyMs)
    store.dispatch({ type: "core/radioFlash" })
    store.scheduler.advance(TIMING.flashMs)
    store.dispatch({ type: "core/radioRegionSet", region: "Europe" })
    store.scheduler.advance(TIMING.startingMs) // radio LIVE, the seek has started
    expect(verdict(store.getSnapshot()).sentence).toContain("alone on the mesh")
    store.scheduler.advance(TIMING.seekStepMs) // network A answers
    const s = store.getSnapshot()
    expect(verdict(s)).toEqual({ sentence: "Your node is running and connected to nearby nodes: messages can flow.", tone: "ok" })
    expect(nearbyRows(meshNeighbours(s, store.world), store.world).map((r) => r.name)).toEqual(["Ridge repeater"])
  })

  it("names what is broken, and adds the internet while the gateway is live", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "mesh", to: "error" })
    expect(verdict(store.getSnapshot())).toMatchObject({ sentence: "Your node is running, but the mesh link has a problem.", tone: "error" })
    store.dispatch({ type: "core/internetConnected", instant: true })
    expect(verdict(store.getSnapshot()).sentence).toBe("Your node is running, but the mesh link has a problem. It can reach the internet.")
  })
})

describe("needs you", () => {
  it("opens with the long-range radio NOT SET and 'Set up with the agent'; the badge does not count it", () => {
    const s = newStore().getSnapshot()
    expect(rowsOf(s)).toEqual([
      {
        key: "setup:radio",
        kindLabel: "service",
        label: "Long-range radio",
        detail: "Needs a radio board.",
        href: PATHS.service("radio"),
        marker: { kind: "dot", state: "unset" },
        setup: "radio",
        demoNote: false,
      },
    ])
    expect(attentionCount(s)).toBe(othersCount(s))
  })

  it("updates in the same dispatch as core: radio live -> the bridge row; proposal -> counted, then gone on accept", () => {
    const store = newStore()
    setUpRadio(store)
    expect(rowsOf(store.getSnapshot()).map((r) => [r.key, r.setup])).toEqual([["setup:bridge", "bridge"]])

    store.dispatch({
      type: "core/proposalAdded",
      proposal: { id: "p1", kind: "setup", title: "Set up the bridge", body: "Join radio and Wi-Fi.", target: "bridge" },
    })
    const withProposal = store.getSnapshot()
    expect(rowsOf(withProposal).map((r) => r.key)).toEqual(["proposal:p1", "setup:bridge"])
    expect(rowsOf(withProposal)[0]).toMatchObject({ kindLabel: "proposal", marker: { kind: "pip" }, href: PATHS.agent, setup: null, detail: "setup proposal from the agent" })
    expect(attentionCount(withProposal)).toBe(othersCount(withProposal) + 1)
    expect(attentionHref(withProposal)).toBe(PATHS.needsYou)

    store.dispatch({ type: "core/proposalAccepted", id: "p1", instant: true })
    const accepted = store.getSnapshot()
    expect(accepted.core.services.find((x) => x.id === "bridge")?.state).toBe("live")
    expect(rowsOf(accepted)).toEqual([])
    expect(attentionCount(accepted)).toBe(othersCount(accepted))
  })

  it("a service in error is a counted row with a labelled ERROR dot and no setup button", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "storage", to: "error", reason: "Store full: new data refused." })
    const row = rowsOf(store.getSnapshot()).find((r) => r.key === "service:storage")
    expect(row).toMatchObject({ kindLabel: "service", label: "Storage", detail: "Store full: new data refused.", marker: { kind: "dot", state: "error" }, setup: null })
    expect(attentionCount(store.getSnapshot())).toBe(othersCount(store.getSnapshot()) + 1)
  })

  it("message requests are a pip row with the demo note, linking to Messages", () => {
    const requests: NeedItem = {
      key: "requests",
      kind: "request",
      label: "2 message requests",
      detail: "Someone you have not added wrote to you. Nothing is sent back until you accept.",
      href: PATHS.messages,
      count: 2,
    }
    expect(needRows([requests], DEMO_WORLD.services)).toEqual([
      {
        key: "requests",
        kindLabel: "messages",
        label: "2 message requests",
        detail: requests.detail,
        href: PATHS.messages,
        marker: { kind: "pip" },
        setup: null,
        demoNote: true,
      },
    ])
  })

  it("whatever requests row the messages slice adds is drawn as a pip with the demo note", () => {
    const s = newStore().getSnapshot()
    for (const r of needRows(needsYou(s).items, s.core.services).filter((x) => x.key === "requests")) {
      expect(r).toMatchObject({ kindLabel: "messages", marker: { kind: "pip" }, demoNote: true, href: PATHS.messages, setup: null })
    }
  })

  it("setupTargetOf only names a NOT SET, agent-set-up service this device can run", () => {
    const services = DEMO_WORLD.services
    expect(setupTargetOf({ key: "setup:radio", kind: "setup" }, services)).toBe("radio")
    expect(setupTargetOf({ key: "setup:agent", kind: "setup" }, services)).toBeNull() // live
    expect(setupTargetOf({ key: "setup:gateway", kind: "setup" }, services)).toBeNull() // turns live by itself
    expect(setupTargetOf({ key: "setup:nothing", kind: "setup" }, services)).toBeNull()
    expect(setupTargetOf({ key: "service:radio", kind: "service" }, services)).toBeNull()
  })
})

describe("first-run checklist", () => {
  it("leads with the identity backup, honestly UNKNOWN, pointing at Settings L2 and never at a command", () => {
    const rows = checklistOf(newStore().getSnapshot())
    expect(rows.map((r) => [r.id, r.state, r.done])).toEqual([
      ["identity", "unknown", false],
      ["model", "live", true],
      ["mesh", "live", true],
      ["peer", "unset", false],
    ])
    expect(rows[0]).toMatchObject({ title: "Identity backup", text: "back up any time from the node itself", href: PATHS.settingsLayer(2) })
    // Plan §6.8: no CLI strings, no hostnames, no recovery-word count.
    const all = JSON.stringify(OVERVIEW_COPY)
    expect(all).not.toMatch(/111 identity|sudo|\.local\b|\bwords?\b/)
  })

  it("is the point until a nearby node is heard, then folds into '3 of 4 done · 1 unknown' (identity never blocks)", () => {
    const store = newStore()
    expect(checklistPending(checklistOf(store.getSnapshot()))).toBe(true)
    setUpRadio(store)
    const rows = checklistOf(store.getSnapshot())
    expect(rows.find((r) => r.id === "peer")).toMatchObject({ state: "live", done: true, text: "at least one nearby node has been heard" })
    expect(checklistPending(rows)).toBe(false)
    expect(checklistSummary(rows)).toBe("First-run checklist · 3 of 4 done · 1 unknown")
  })
})

describe("nearby summary", () => {
  it("lists the nodes heard over the mesh in order, with plain device words and the relay line", () => {
    const store = newStore()
    setUpRadio(store)
    const rows = nearbyRows(meshNeighbours(store.getSnapshot(), store.world), store.world)
    expect(rows).toEqual([
      { key: "ridge-repeater", name: "Ridge repeater", device: "radio relay", via: "over long-range radio", relay: true },
      { key: "valley-hub", name: "Valley hub", device: "home server", via: "over long-range radio", relay: false },
      { key: "bram", name: "Bram", device: "small box with a radio", via: "over long-range radio", relay: false },
    ])
    expect(OVERVIEW_COPY.nearby.relay).toBe("forwards sealed traffic; cannot read it")
    expect(homeHubLine(homeHubHeard(store.getSnapshot(), store.world), store.world)).toBeNull()
  })
})

describe("node facts", () => {
  it("open as the sample node: plain device words, its hardware, uptime since its first service, no internet", () => {
    const f = factsOf(newStore())
    expect(f).toMatchObject({
      name: "Workshop laptop",
      device: "laptop",
      hardware: "Wi-Fi that can host a hotspot · Bluetooth · USB ports · no ethernet port · no radio board yet",
      version: "V.test",
      uptime: "7 h 12 min",
      updates: "up to date",
      lastCheck: "3 h ago",
      gateway: "no internet",
      dashboard: "this device only",
    })
    expect(f.label).toMatch(LABEL_PATTERN)
    expect(nodeStartedAt(DEMO_WORLD)).toBe(-(7 * HOUR + 12 * MIN))
  })

  it("say 'also bridges radio and Wi-Fi' only under the bootstrap rule, and follow the gateway overlay", () => {
    const store = newStore()
    expect(deviceText(ownDevice(store.getSnapshot(), store.world))).toBe("laptop")
    store.dispatch({ type: "core/radioPlugged" })
    expect(deviceText(ownDevice(store.getSnapshot(), store.world))).toBe("laptop") // a board that is not live yet
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(factsOf(store).device).toBe("laptop · also bridges radio and Wi-Fi")
    expect(factsOf(store).hardware).toContain("a radio board on USB")
    expect(deviceText({ deviceLabel: "laptop", bridges: false })).toBe("laptop")

    store.dispatch({ type: "core/internetConnected" })
    expect(factsOf(store).gateway).toBe("checking")
    store.scheduler.runUntilIdle()
    expect(factsOf(store).gateway).toBe("internet reachable")
    store.dispatch({ type: "core/internetLost" })
    expect(gatewayText(store.getSnapshot().core.services)).toBe("no internet")
  })

  it("updates: 'up to date' until a check on this page, then the latest update event; last check from the latest check", () => {
    const ev = (seq: number, cause: DemoEvent["cause"], at: number, text: string): DemoEvent => ({ seq, cause, at, text, ref: null })
    expect(updateFacts([], 0)).toEqual({ updates: "up to date", lastCheck: "3 h ago" })
    expect(SAMPLE_LAST_CHECK).toBe(-(3 * HOUR + 12 * MIN))
    const checked = [ev(1, "update-check", 10 * SEC, "Checked for updates.")]
    expect(updateFacts(checked, 12 * SEC)).toEqual({ updates: "Checked for updates.", lastCheck: "just now" })
    const healthy = [...checked, ev(2, "node-heard", 20 * SEC, "x"), ev(3, "update-healthy", 30 * SEC, "The new version passed its trial.")]
    expect(updateFacts(healthy, 5 * MIN)).toEqual({ updates: "The new version passed its trial.", lastCheck: "4 min ago" })
  })
})

describe("activity", () => {
  it("prints virtual time and the event's sentence, the newest n oldest first", () => {
    expect(activityLine({ at: 12 * MIN + 5 * SEC, text: "Joined Network A. Heartbeats started." })).toBe("09:12:05 · Joined Network A. Heartbeats started.")
    const events: DemoEvent[] = [1, 2, 3].map((seq) => ({ seq, cause: "node-heard", at: seq * SEC, text: `e${seq}`, ref: null }))
    expect(activityLines(events, 2)).toEqual(["09:00:02 · e2", "09:00:03 · e3"])
    expect(activityLines(events, 10)).toHaveLength(3)
    expect(activityLines([], 20)).toEqual([])
  })

  it("follows the store's events log as things happen", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    expect(activityLines(store.getSnapshot().core.events, 20)).toEqual(["09:00:00 · A radio board was plugged in."])
  })
})
