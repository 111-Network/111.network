// The kb slice through a memory store: UI state only (reader + find text), never scheduled, never
// emitted, never asking for the visitor, and kept while the visitor moves around the demo.
import { describe, expect, it } from "vitest"
import { PATHS } from "../router"
import { createDemoStore } from "../store"
import { DEMO_WORLD } from "../world"
import { clampKbQuery, initialKb, KB_QUERY_MAX, needsKb } from "./kb"

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: PATHS.kb })

describe("kb slice", () => {
  it("opens on the human reader with an empty find text", () => {
    expect(initialKb()).toEqual({ reader: "human", query: "" })
    expect(newStore().getSnapshot().kb).toEqual({ reader: "human", query: "" })
  })

  it("switches the reader, and repeating the current choice changes nothing (no notify)", () => {
    const store = newStore()
    let woke = 0
    const off = store.subscribe(() => woke++)
    store.dispatch({ type: "kb/setReader", reader: "agent" })
    expect(store.getSnapshot().kb.reader).toBe("agent")
    expect(woke).toBe(1)
    const before = store.getSnapshot()
    store.dispatch({ type: "kb/setReader", reader: "agent" })
    expect(store.getSnapshot()).toBe(before)
    expect(woke).toBe(1)
    store.dispatch({ type: "kb/setReader", reader: "human" })
    expect(store.getSnapshot().kb.reader).toBe("human")
    off()
  })

  it("keeps the find text as typed, clamped to KB_QUERY_MAX; the same text is a no-op", () => {
    const store = newStore()
    store.dispatch({ type: "kb/setQuery", query: "Radio " })
    expect(store.getSnapshot().kb.query).toBe("Radio ")
    const before = store.getSnapshot()
    store.dispatch({ type: "kb/setQuery", query: "Radio " })
    expect(store.getSnapshot()).toBe(before)
    const long = "x".repeat(KB_QUERY_MAX + 20)
    store.dispatch({ type: "kb/setQuery", query: long })
    expect(store.getSnapshot().kb.query).toHaveLength(KB_QUERY_MAX)
    expect(clampKbQuery(long)).toBe("x".repeat(KB_QUERY_MAX))
    expect(clampKbQuery("hub")).toBe("hub")
  })

  it("schedules nothing, emits nothing and never asks for the visitor", () => {
    const store = newStore()
    const pending = store.scheduler.pending().length
    const events = store.getSnapshot().core.events.length
    store.dispatch({ type: "kb/setReader", reader: "agent" })
    store.dispatch({ type: "kb/setQuery", query: "bridge" })
    expect(store.scheduler.pending()).toHaveLength(pending)
    expect(store.getSnapshot().core.events).toHaveLength(events)
    expect(needsKb()).toEqual([])
  })

  it("ignores every other action (same reference), and survives moving between views", () => {
    const store = newStore()
    store.dispatch({ type: "kb/setReader", reader: "agent" })
    store.dispatch({ type: "kb/setQuery", query: "phone" })
    const kb = store.getSnapshot().kb
    store.dispatch({ type: "core/radioPlugged" })
    store.navigate(PATHS.kbDrawer("concepts"))
    store.navigate(PATHS.overview)
    store.navigate(PATHS.kbNote("concepts", "thin-bridge"))
    store.scheduler.runUntilIdle()
    expect(store.getSnapshot().kb).toBe(kb)
  })
})
