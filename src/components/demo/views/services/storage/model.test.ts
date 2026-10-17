// The Storage page's pure model: the word gauge (one bar per internal unit, never a number), the
// class parts, the free log and the hubs heard over long-range radio.
import { describe, expect, it } from "vitest"
import { STORAGE_COPY } from "../../../copy/storage"
import type { HeardEntry } from "../../../engine/core"
import { createDemoStore, type DemoStore } from "../../../engine/store"
import { DEMO_WORLD } from "../../../engine/world"
import { FETCH_KEY, MAP_PIECE, STORAGE_TIMING, STORE_CAPACITY, STORE_PRESSURE, initialStorage, usedUnits, type StorageState } from "../../../engine/slices/storage"
import { activeRules, describeGauge, gaugeCells, gaugeWord, logLines, mapOnHub, partState, radioHubs, ruleChip } from "./model"

const setup = (): DemoStore => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })
const st = (s: DemoStore): StorageState => s.getSnapshot().storage

/** Run the fetch until it reaches `phase` (one scheduled step at a time). */
function runTo(s: DemoStore, phase: StorageState["fetch"]["phase"]): StorageState {
  s.dispatch({ type: "storage/fetchMap" })
  for (let i = 0; i < 20 && st(s).fetch.phase !== phase; i++) {
    const task = s.scheduler.pending().find((p) => p.key === FETCH_KEY)
    if (!task) break
    s.scheduler.advance(task.due - s.scheduler.now())
  }
  return st(s)
}

describe("storage model: the gauge", () => {
  it("has one bar per unit of capacity, lit by place in the order, the rest free", () => {
    const storage = initialStorage()
    const cells = gaugeCells(storage)
    expect(cells).toHaveLength(STORE_CAPACITY)
    expect(cells.filter((c) => c !== "empty")).toHaveLength(usedUnits(storage))
    // What stays longest is drawn first; what goes first sits next to the line.
    const lit = cells.filter((c) => c !== "empty")
    expect(lit[0]).toBe("kept")
    expect(lit[lit.length - 1]).toBe("rule1")
    expect(gaugeWord(storage)).toBe("room")
  })

  it("shows the map's pieces arriving, the overshoot past the line, then the freed room as dashed bars", () => {
    const s = setup()
    s.dispatch({ type: "storage/fetchMap" })
    s.scheduler.advance(STORAGE_TIMING.askMs)
    expect(gaugeCells(st(s)).filter((c) => c === "arriving")).toHaveLength(MAP_PIECE)

    const pruning = runTo(s, "pruning")
    expect(usedUnits(pruning)).toBeGreaterThan(STORE_PRESSURE)
    expect(gaugeWord(pruning)).toBe("short")

    s.scheduler.advance(STORAGE_TIMING.pruneMs)
    const freed = st(s)
    const cells = gaugeCells(freed)
    expect(cells).toHaveLength(STORE_CAPACITY)
    expect(cells.filter((c) => c === "freed").length).toBe((freed.last?.peak ?? 0) - usedUnits(freed))
    expect(gaugeWord(freed)).toBe("freed")
    expect(activeRules(freed)).toEqual(new Set([1, 2]))
  })

  it("says full only at capacity", () => {
    const storage = initialStorage()
    const full: StorageState = { ...storage, items: [{ id: "x", kind: "carried", units: STORE_CAPACITY, seq: 1 }] }
    expect(gaugeWord(full)).toBe("full")
  })

  it("describes itself in words only: no number, no percentage", () => {
    const s = setup()
    expect(describeGauge(st(s))).toMatch(/^Store gauge: room to spare\. Holds /)
    runTo(s, "done")
    const done = describeGauge(st(s))
    expect(done).toContain(STORAGE_COPY.classes.kinds.map)
    expect(done).toContain(STORAGE_COPY.gauge.whyFreed.trim())
    for (const text of [describeGauge(initialStorage()), done]) expect(text).not.toMatch(/\d|%/)
  })
})

describe("storage model: classes, chips and the log", () => {
  it("marks each part held, arriving, freed just now, on the hub or none", () => {
    const s = setup()
    expect(partState(st(s), "history")).toBe("held")
    expect(partState(st(s), "map")).toBe("onHub")
    expect(mapOnHub(st(s))).toBe("onHub")
    s.dispatch({ type: "storage/fetchMap" })
    expect(partState(st(s), "map")).toBe("arriving")
    expect(mapOnHub(st(s))).toBe("arriving")
    runTo(s, "done")
    expect(partState(st(s), "map")).toBe("held")
    expect(mapOnHub(st(s))).toBe("held")
    expect(partState(st(s), "superseded")).toBe("freed")
    expect(partState(st(s), "carried")).toBe("held")
  })

  it("chips each part with its rule, never freed or kept", () => {
    expect(ruleChip("handed")).toBe("rule 1")
    expect(ruleChip("superseded")).toBe("rule 2")
    expect(ruleChip("history")).toBe("rule 3")
    expect(ruleChip("carried")).toBe(STORAGE_COPY.classes.never)
    expect(ruleChip("update")).toBe(STORAGE_COPY.classes.kept)
  })

  it("logs one line per prune with the virtual clock, nothing while idle", () => {
    const s = setup()
    expect(logLines(st(s))).toEqual([])
    runTo(s, "done")
    const lines = logLines(st(s))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^\d\d:\d\d {2}regional map → freed /)
    expect(lines[0]).toContain("(rule 2)")
  })
})

describe("storage model: hubs", () => {
  const entry = (id: HeardEntry["id"], via: HeardEntry["via"]): HeardEntry => ({
    id,
    via,
    cause: "radio-ready",
    firstCause: "radio-ready",
    firstAt: 0,
    lastAt: 0,
    count: 1,
    blip: 1,
  })

  it("lists only hubs heard over long-range radio (never the home hub on Wi-Fi, never people or relays)", () => {
    const heard = [entry("valley-hub", "radio"), entry("workshop-hub", "wifi"), entry("ridge-repeater", "radio"), entry("bram", "radio")]
    expect(radioHubs(heard, DEMO_WORLD).map((h) => h.id)).toEqual(["valley-hub"])
    expect(radioHubs([], DEMO_WORLD)).toEqual([])
  })
})
