import { describe, expect, it } from "vitest"
import { DEVICE_IDS, type DeviceId } from "@/lib/devices"
import { createRng, pick } from "@/lib/prng"
import {
  BATCH_LABEL,
  BATCH_ORDER,
  CELL_CLASS,
  FILL_START,
  FREE_ORDER,
  GRID_COLUMNS,
  LOG_LIMIT,
  MAX_FILL_POURS,
  STORE_FULL,
  STORE_SIZE,
  cellViews,
  createStore,
  describeStore,
  fillSummary,
  gaugeMarks,
  gaugeOf,
  ghostOf,
  initialStoreMap,
  isRefused,
  logLine,
  meterBars,
  narrate,
  pour,
  pressureBar,
  profileFor,
  storeMapReducer,
  usedCells,
  type BatchId,
  type CellClass,
  type PourOutcome,
  type Store,
  type StoreMapState,
} from "./model"

const STORING = DEVICE_IDS.filter((id) => STORE_SIZE[id] !== "none")
const BARS = 32

interface Step {
  before: Store
  store: Store
  outcome: PourOutcome
}

/** Pour BATCH_ORDER round and round from a fresh store until a pour is refused (or the cap). */
function canonicalRun(device: DeviceId): Step[] {
  const steps: Step[] = []
  let store = createStore(device)
  for (let i = 0; i < MAX_FILL_POURS; i++) {
    const before = store
    const result = pour(store, device, BATCH_ORDER[i % BATCH_ORDER.length])
    store = result.store
    steps.push({ ...result, before })
    if (result.outcome.status === "refused") break
  }
  return steps
}

/** Seeded random pour sequences on one device: every step of every run. */
function randomSteps(device: DeviceId, seed: string, runs = 30, length = 30): Step[] {
  const rng = createRng(`${seed}-${device}`)
  const steps: Step[] = []
  for (let run = 0; run < runs; run++) {
    let store = createStore(device)
    for (let i = 0; i < length; i++) {
      const before = store
      const result = pour(store, device, pick(rng, BATCH_ORDER))
      store = result.store
      steps.push({ ...result, before })
    }
  }
  return steps
}

/** Canonical and random steps on every storing device. */
function everyStep(seed: string): { id: DeviceId; step: Step }[] {
  return STORING.flatMap((id) => [...canonicalRun(id), ...randomSteps(id, seed)].map((step) => ({ id, step })))
}

function cellsOfClass(store: Store, cls: CellClass): number {
  return store.items.filter((item) => CELL_CLASS[item.kind] === cls).reduce((n, item) => n + item.cells.length, 0)
}

function incomingCells(device: DeviceId, batch: BatchId): number {
  return profileFor(device).batches[batch].reduce((n, part) => n + part.cells, 0)
}

/** Cells rules 1–2 (or 1–3) could free for this pour, counting the running update an arriving update would supersede. */
function freeable(step: Step, rules: readonly number[]): number {
  const supersedes = step.outcome.batch === "update"
  return step.before.items
    .filter((item) => {
      const cls = supersedes && item.kind === "update" ? 2 : CELL_CLASS[item.kind]
      return typeof cls === "number" && rules.includes(cls)
    })
    .reduce((n, item) => n + item.cells.length, 0)
}

describe("per-device store size", () => {
  it("follows the plan: relay none, phone and radio box small, laptop medium, server and graphics PC large", () => {
    expect(STORE_SIZE).toEqual({
      "radio-relay": "none",
      "old-phone": "small",
      "radio-box": "small",
      laptop: "medium",
      "home-server": "large",
      "gpu-pc": "large",
    })
    const cap = (id: DeviceId) => profileFor(id).capacity
    expect(cap("radio-relay")).toBe(0)
    expect(cap("old-phone")).toBe(cap("radio-box"))
    expect(cap("old-phone")).toBeLessThan(cap("laptop"))
    expect(cap("laptop")).toBeLessThan(cap("home-server"))
    expect(cap("home-server")).toBe(cap("gpu-pc"))
  })

  it("draws whole rows of the grid, with the pressure line below capacity", () => {
    for (const id of STORING) {
      const { capacity, pressure } = profileFor(id)
      expect(capacity % GRID_COLUMNS).toBe(0)
      expect(pressure).toBeGreaterThan(0)
      expect(pressure).toBeLessThan(capacity)
    }
  })

  it("starts each store with only the update it runs", () => {
    for (const id of STORING) {
      const store = createStore(id)
      expect(store.items.map((item) => item.kind)).toEqual(["update"])
      expect(store.exportOffered).toBe(false)
    }
  })
})

describe("radio relay", () => {
  it("forwards without keeping: every pour stores nothing and names the batch", () => {
    const store = createStore("radio-relay")
    expect(store.capacity).toBe(0)
    for (const batch of BATCH_ORDER) {
      const result = pour(store, "radio-relay", batch)
      expect(result.outcome.status).toBe("forwarded")
      expect(result.store).toBe(store)
      // One phrasing for one batch or many: never "messages … without keeping it".
      expect(narrate(result.outcome, result.store)).toMatch(/^Passed on .+ without keeping a copy: a radio relay's store stays empty\.$/)
      expect(logLine(result.outcome)).toBeNull()
    }
    expect(gaugeOf(store, null)).toBe("none")
  })

  it("has nothing to fill", () => {
    const state = storeMapReducer(initialStoreMap("radio-relay"), { type: "fill", whole: false })
    expect(state.filling).toBe(false)
    expect(state.pours).toBe(0)
    expect(state.message).toContain("forwards without keeping")
  })

  it("still answers a repeated click with a changed line", () => {
    let state = initialStoreMap("radio-relay")
    const lines: string[] = []
    for (let i = 0; i < 3; i++) {
      state = storeMapReducer(state, { type: "pour", batch: "map" })
      lines.push(state.message)
    }
    expect(lines[0]).toMatch(/^Passed on a regional map/)
    expect(lines[1]).toBe(`Again: ${lines[0]}`)
    expect(lines[2]).toBe(`Once more: ${lines[0]}`)
  })
})

describe("pressure line", () => {
  it("is crossed on the 4th pour in order, never before, for every storing device", () => {
    for (const id of STORING) {
      const steps = canonicalRun(id)
      for (const step of steps.slice(0, 3)) {
        expect(step.outcome.status).toBe("stored")
        expect(step.outcome.freed).toEqual([])
        expect(gaugeOf(step.store, step.outcome)).toBe("room")
        expect(ghostOf(step.outcome)).toBeNull()
      }
      const fourth = steps[3]
      expect(fourth.outcome.peak).toBeGreaterThan(fourth.before.pressure)
      expect(fourth.outcome.freed.length).toBeGreaterThan(0)
      expect(fourth.outcome.freed.every((item) => item.rule === 1)).toBe(true)
      expect(fourth.outcome.freed[0]).toMatchObject({ kind: "map", rule: 1 })
    }
  })

  it("shows the crossing on the gauge: the 4th pour's dashed peak passes the tick, then the lit bars drop back under it", () => {
    for (const id of STORING) {
      const steps = canonicalRun(id)
      const { capacity } = steps[0].store
      const tick = pressureBar(steps[0].store, BARS)
      expect(meterBars(usedCells(steps[2].store), capacity, BARS)).toBeLessThan(tick)
      const fourth = steps[3]
      expect(ghostOf(fourth.outcome)).toBe("freed")
      expect(meterBars(fourth.outcome.peak, capacity, BARS)).toBeGreaterThan(tick)
      expect(meterBars(usedCells(fourth.store), capacity, BARS)).toBeLessThanOrEqual(tick)
      expect(gaugeOf(fourth.store, fourth.outcome)).toBe("freed")
    }
  })

  it("gives every prune a cause: it happens only when the pour would cross the line, and the strip shows its overshoot", () => {
    for (const { id, step } of everyStep("l8-cause")) {
      if (step.outcome.freed.length === 0) continue
      expect(step.outcome.status).toBe("stored")
      expect(step.outcome.peak).toBe(usedCells(step.before) + incomingCells(id, step.outcome.batch))
      expect(step.outcome.peak).toBeGreaterThan(step.before.pressure)
      const marks = gaugeMarks(step.store, step.outcome, BARS)
      expect(marks.ghostEnd > marks.lit || marks.overflow).toBe(true)
      expect(marks.overflow).toBe(step.outcome.peak > step.store.capacity)
    }
  })
})

describe("free-space order (W3)", () => {
  it("lists four rules, the last one NEVER", () => {
    expect(FREE_ORDER.map((r) => r.rule)).toEqual([1, 2, 3, 4])
    expect(FREE_ORDER[3].text.startsWith("NEVER")).toBe(true)
  })

  it("maps every kind to its rule", () => {
    expect(CELL_CLASS).toEqual({
      map: 1,
      handed: 1,
      superseded: 2,
      history: 3,
      carried: "never",
      outbox: "never",
      update: "kept",
    })
  })

  it("frees rule 1 before 2 before 3 within a pour, oldest first within a rule, under any order of pours", () => {
    for (const { step } of everyStep("l8-order")) {
      const { freed } = step.outcome
      for (let i = 1; i < freed.length; i++) {
        expect(freed[i].rule).toBeGreaterThanOrEqual(freed[i - 1].rule)
        if (freed[i].rule === freed[i - 1].rule) expect(freed[i].id).toBeGreaterThan(freed[i - 1].id)
      }
      // Oldest first: nothing older of the same rule is left behind.
      for (const item of freed) {
        const olderLeft = step.store.items.some((kept) => CELL_CLASS[kept.kind] === item.rule && kept.id < item.id)
        expect(olderLeft).toBe(false)
      }
    }
  })

  it("reaches your history only after everything under rules 1 and 2 is freed, and only when that still leaves no room", () => {
    let checked = 0
    for (const { id, step } of everyStep("l8-hard")) {
      if (!step.outcome.freed.some((item) => item.rule === 3)) continue
      const freedIds = new Set(step.outcome.freed.map((item) => item.id))
      for (const item of step.before.items) {
        const cls = step.outcome.batch === "update" && item.kind === "update" ? 2 : CELL_CLASS[item.kind]
        if (cls === 1 || cls === 2) expect(freedIds.has(item.id)).toBe(true)
      }
      const incoming = incomingCells(id, step.outcome.batch)
      expect(usedCells(step.before) - freeable(step, [1, 2]) + incoming).toBeGreaterThan(step.before.capacity)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it("offers the export before (or as) your history is first freed, and only once per store", () => {
    for (const id of STORING) {
      const rng = createRng(`l8-export-${id}`)
      for (let run = 0; run < 30; run++) {
        let store = createStore(id)
        let offers = 0
        const sequence = run === 0 ? Array.from({ length: 12 }, (_, i) => BATCH_ORDER[i % 4]) : Array.from({ length: 30 }, () => pick(rng, BATCH_ORDER))
        for (const batch of sequence) {
          const before = store
          const result = pour(store, id, batch)
          if (result.outcome.exportOffered) {
            offers++
            expect(before.exportOffered).toBe(false)
          }
          if (result.outcome.freed.some((item) => item.rule === 3)) expect(result.store.exportOffered).toBe(true)
          store = result.store
        }
        expect(offers).toBeLessThanOrEqual(1)
      }
    }
  })

  it("never lets public data you can fetch again push out your history", () => {
    let declined = 0
    for (const { id, step } of everyStep("l8-map")) {
      if (step.outcome.batch === "map") expect(step.outcome.freed.some((item) => item.rule === 3)).toBe(false)
      if (step.outcome.status !== "declined") continue
      declined++
      expect(step.outcome.batch).toBe("map")
      const incoming = incomingCells(id, "map")
      const used = usedCells(step.before)
      // Only your history's room would have made it fit.
      expect(used - freeable(step, [1, 2]) + incoming).toBeGreaterThan(step.before.capacity)
      expect(used - freeable(step, [1, 2, 3]) + incoming).toBeLessThanOrEqual(step.before.capacity)
    }
    expect(declined).toBeGreaterThan(0)
  })

  it("frees the oldest regional map first", () => {
    let store = createStore("old-phone")
    const maps: number[] = []
    for (let i = 0; i < 8; i++) {
      const result = pour(store, "old-phone", "map")
      store = result.store
      for (const item of result.outcome.freed) maps.push(item.id)
    }
    expect(maps.length).toBeGreaterThan(1)
    expect([...maps].sort((a, b) => a - b)).toEqual(maps)
  })

  it("shows rules 1, 2 and 3 during one fill for every storing device, with your history first freed for your own data", () => {
    for (const id of STORING) {
      const steps = canonicalRun(id)
      const rules = new Set(steps.flatMap((step) => step.outcome.freed.map((item) => item.rule)))
      expect([...rules].sort()).toEqual([1, 2, 3])
      expect(steps.some((step) => step.outcome.status === "declined")).toBe(false)
      const first = steps.find((step) => step.outcome.freed.some((item) => item.rule === 3))
      expect(first?.outcome.exportOffered).toBe(true)
      expect(["history", "carried"]).toContain(first?.outcome.batch)
      for (const step of steps) {
        if (step.outcome.freed.some((item) => item.rule === 3)) expect(["map", "update"]).not.toContain(step.outcome.batch)
      }
    }
  })
})

describe("never-prune rule", () => {
  it("never frees anything not yet delivered, nor the update in use, under any order of pours", () => {
    for (const id of STORING) {
      for (const step of [...canonicalRun(id), ...randomSteps(id, "l8-never")]) {
        for (const item of step.outcome.freed) {
          expect(CELL_CLASS[item.kind]).not.toBe("never")
          expect(item.kind).not.toBe("update")
        }
        expect(cellsOfClass(step.store, "never")).toBeGreaterThanOrEqual(cellsOfClass(step.before, "never"))
      }
    }
  })

  it("keeps cell positions unique and inside the grid", () => {
    for (const { step } of everyStep("l8-cells")) {
      const cells = step.store.items.flatMap((item) => item.cells)
      expect(new Set(cells).size).toBe(cells.length)
      expect(cells.every((c) => c >= 0 && c < step.store.capacity)).toBe(true)
      expect(usedCells(step.store)).toBeLessThanOrEqual(step.store.capacity)
    }
  })

  it("leaves the cells it just freed visible while there is other room", () => {
    const fourth = canonicalRun("old-phone")[3]
    const freedCells = new Set(fourth.outcome.freed.flatMap((item) => item.cells))
    expect(fourth.outcome.added.some((cell) => freedCells.has(cell))).toBe(false)
    const views = cellViews(fourth.store, fourth.outcome)
    expect(views.filter((view) => view.state === "freed")).toHaveLength(freedCells.size)
  })
})

describe("refuse when full", () => {
  it("refuses only what would not fit even after everything rules 1–3 allow, and then frees nothing", () => {
    let refused = 0
    for (const { id, step } of everyStep("l8-refuse")) {
      if (step.outcome.status !== "refused" && step.outcome.status !== "declined") continue
      // Nothing changes: no free, no export offer, nothing stored, no update superseded.
      expect(step.store).toBe(step.before)
      expect(step.outcome.freed).toEqual([])
      expect(step.outcome.exportOffered).toBe(false)
      expect(step.outcome.added).toEqual([])
      expect(step.outcome.superseded).toBe(false)
      if (step.outcome.status === "declined") continue
      refused++
      const incoming = incomingCells(id, step.outcome.batch)
      expect(usedCells(step.before) - freeable(step, [1, 2, 3]) + incoming).toBeGreaterThan(step.before.capacity)
      expect(step.outcome.peak).toBeGreaterThan(step.before.capacity)
    }
    expect(refused).toBeGreaterThan(0)
  })

  it("stores whatever fits once the order has made room", () => {
    for (const { id, step } of everyStep("l8-stores")) {
      if (step.outcome.status !== "stored") continue
      const incoming = incomingCells(id, step.outcome.batch)
      expect(step.outcome.added).toHaveLength(incoming)
      expect(usedCells(step.store)).toBe(usedCells(step.before) + incoming - step.outcome.freed.reduce((n, item) => n + item.cells.length, 0))
    }
  })

  it("ends every fill with a refusal, within a dozen pours, with almost only undelivered data left", () => {
    for (const id of STORING) {
      const steps = canonicalRun(id)
      const last = steps[steps.length - 1]
      expect(last.outcome.status).toBe("refused")
      expect(steps.length).toBeLessThanOrEqual(12)
      expect(["history", "carried"]).toContain(last.outcome.batch)
      expect(last.store).toBe(last.before)
      const { capacity } = last.store
      const never = cellsOfClass(last.store, "never") + cellsOfClass(last.store, "kept")
      expect(never).toBeGreaterThan(capacity * 0.8)
      expect(narrate(last.outcome, last.store)).toContain(STORE_FULL)
      expect(narrate(last.outcome, last.store)).toContain("nothing was freed")
      expect(gaugeOf(last.store, last.outcome)).toBe("unfit")
      expect(ghostOf(last.outcome)).toBe("unfit")
    }
  })
})

describe("updates", () => {
  it("supersede the update the node ran", () => {
    const { store, outcome } = pour(createStore("laptop"), "laptop", "update")
    expect(outcome.superseded).toBe(true)
    expect(store.items.map((item) => item.kind)).toEqual(["superseded", "update"])
  })

  it("never cost the node its running update when refused", () => {
    const store: Store = {
      capacity: 6,
      pressure: 4,
      nextId: 2,
      exportOffered: false,
      items: [
        { id: 0, kind: "update", cells: [0] },
        { id: 1, kind: "carried", cells: [1, 2, 3, 4, 5] },
      ],
    }
    const result = pour(store, "old-phone", "update")
    expect(result.outcome.status).toBe("refused")
    expect(result.outcome.superseded).toBe(false)
    expect(result.store).toBe(store)
  })
})

describe("gauge", () => {
  it("lights at least one bar when anything is stored and all bars only when full", () => {
    expect(meterBars(0, 48, 32)).toBe(0)
    expect(meterBars(1, 48, 32)).toBe(1)
    expect(meterBars(47, 48, 32)).toBe(31)
    expect(meterBars(48, 48, 32)).toBe(32)
    expect(meterBars(60, 48, 32)).toBe(32)
    expect(meterBars(5, 0, 32)).toBe(0)
  })

  it("agrees with the narration on every pour", () => {
    for (const { step } of everyStep("l8-gauge")) {
      const gauge = gaugeOf(step.store, step.outcome)
      const line = narrate(step.outcome, step.store)
      if (line.includes("Space ran short")) expect(gauge).toBe("freed")
      if (line.includes("No room left")) expect(gauge).toBe("cut")
      if (line.includes("Room to spare")) expect(gauge).toBe("room")
      if (gauge === "unfit") expect(step.outcome.status === "refused" || step.outcome.status === "declined").toBe(true)
      // "Store full" belongs to the refusal alone.
      expect(line.includes("Store full")).toBe(step.outcome.status === "refused")
    }
  })

  it("reads room, then ran short, then no room left, then no room for the batch", () => {
    const steps = canonicalRun("home-server")
    const words = steps.map((step) => gaugeOf(step.store, step.outcome))
    expect(words[0]).toBe("room")
    expect(words).toContain("freed")
    expect(words).toContain("cut")
    expect(words[words.length - 1]).toBe("unfit")
  })
})

describe("copy", () => {
  const strip = (text: string) => text.replace(/rules? [1-4]( and [1-4])?/g, "")

  it("prints no numbers except rule numbers", () => {
    for (const id of DEVICE_IDS) {
      const texts: string[] = [describeStore(createStore(id), id, null)]
      for (const step of [...canonicalRun(id), ...randomSteps(id, "l8-copy", 5, 20)]) {
        texts.push(narrate(step.outcome, step.store), logLine(step.outcome) ?? "", describeStore(step.store, id, step.outcome))
      }
      texts.push(storeMapReducer(initialStoreMap(id), { type: "fill", whole: true }).message)
      for (const text of texts) expect(strip(text)).not.toMatch(/\d/)
    }
  })

  it("names every prune's cause and rule", () => {
    const steps = canonicalRun("laptop")
    const fourth = steps[3]
    const line = narrate(fourth.outcome, fourth.store)
    expect(line).toContain("Poured an update")
    expect(line).toContain("Space ran short")
    expect(line).toContain("regional map (rule 1")
    expect(logLine(fourth.outcome)).toBe(`${BATCH_LABEL.update} → ran short: freed a regional map (rule 1: you can fetch it again)`)
    const hard = steps.find((step) => step.outcome.exportOffered)
    expect(hard && narrate(hard.outcome, hard.store)).toMatch(/No room left: .*export offered, then freed your oldest history \(rule 3\)\.$/)
  })

  it("says export offered once, then only freed", () => {
    const lines = canonicalRun("old-phone").map((step) => narrate(step.outcome, step.store))
    expect(lines.filter((line) => line.includes("export offered"))).toHaveLength(1)
  })
})

describe("Store Map reducer", () => {
  const run = (state: StoreMapState, ticks: number) => {
    let next = state
    for (let i = 0; i < ticks; i++) next = storeMapReducer(next, { type: "tick" })
    return next
  }

  it("pours one batch per click and announces it", () => {
    const state = storeMapReducer(initialStoreMap("laptop"), { type: "pour", batch: "history" })
    expect(state.pours).toBe(1)
    expect(state.last?.batch).toBe("history")
    expect(state.message).toContain("Poured your history")
  })

  it("changes the line on a repeated outcome, so it is announced again", () => {
    let state = storeMapReducer(initialStoreMap("old-phone"), { type: "fill", whole: true })
    expect(isRefused(state)).toBe(true)
    const batch = state.last?.batch ?? "history"
    state = storeMapReducer(state, { type: "pour", batch })
    const first = state.message
    state = storeMapReducer(state, { type: "pour", batch })
    expect(state.message).toBe(`Again: ${first}`)
    state = storeMapReducer(state, { type: "pour", batch })
    expect(state.message).toBe(`Once more: ${first}`)
  })

  it("does nothing on a tick unless FILL IT was clicked (no idle demo)", () => {
    const state = initialStoreMap("laptop")
    expect(storeMapReducer(state, { type: "tick" })).toBe(state)
  })

  it("FILL IT pours at once, then steps quietly (log only) until refused, then announces one summary", () => {
    let state = storeMapReducer(initialStoreMap("old-phone"), { type: "fill", whole: false })
    expect(state.pours).toBe(1)
    expect(state.filling).toBe(true)
    expect(state.message).toBe(FILL_START)
    let ticks = 0
    while (state.filling && ticks < MAX_FILL_POURS) {
      state = storeMapReducer(state, { type: "tick" })
      ticks++
      if (state.filling) expect(state.message).toBe(FILL_START)
    }
    expect(state.filling).toBe(false)
    expect(isRefused(state)).toBe(true)
    expect(state.message).toBe(
      "Filled until the store refused new data: space ran short, so rules 1 and 2 freed room; with no room left, the export was offered and rule 3 freed your oldest history. Store full: new data refused.",
    )
    expect(state.run).toBeNull()
  })

  it("continues the order from the last pour", () => {
    let state = storeMapReducer(initialStoreMap("laptop"), { type: "pour", batch: "map" })
    state = storeMapReducer(state, { type: "pour", batch: "map" })
    state = storeMapReducer(state, { type: "fill", whole: false })
    expect(state.last?.batch).toBe(BATCH_ORDER[2])
  })

  it("resolves whole under reduced motion, to the same end and the same summary as stepping", () => {
    for (const id of STORING) {
      const whole = storeMapReducer(initialStoreMap(id), { type: "fill", whole: true })
      const stepped = run(storeMapReducer(initialStoreMap(id), { type: "fill", whole: false }), MAX_FILL_POURS)
      expect(whole.filling).toBe(false)
      expect(whole.store).toEqual(stepped.store)
      expect(whole.pours).toBe(stepped.pours)
      expect(whole.log).toEqual(stepped.log)
      expect(whole.message).toBe(stepped.message)
      expect(isRefused(whole)).toBe(true)
    }
  })

  it("announces the pour itself when FILL IT ends on its first pour", () => {
    const full = storeMapReducer(initialStoreMap("laptop"), { type: "fill", whole: true })
    // Step the order back one, so FILL IT's first pour is the batch just refused.
    const again = storeMapReducer({ ...full, pours: full.pours - 1 }, { type: "fill", whole: false })
    expect(again.filling).toBe(false)
    expect(again.message).toContain(STORE_FULL)
    expect(again.message).toMatch(/Refused /)
  })

  it("stops on STOP with a summary so far, or on any pour", () => {
    let filling = storeMapReducer(initialStoreMap("laptop"), { type: "fill", whole: false })
    filling = run(filling, 4)
    expect(filling.filling).toBe(true)
    const stopped = storeMapReducer(filling, { type: "stop" })
    expect(stopped.filling).toBe(false)
    expect(stopped.message).toMatch(/^Filling stopped: space ran short, so rules 1 and 2 freed room\. Pour again/)
    expect(storeMapReducer(stopped, { type: "stop" })).toBe(stopped)
    const poured = storeMapReducer(filling, { type: "pour", batch: "update" })
    expect(poured.filling).toBe(false)
    expect(poured.message).toContain("Poured an update")
  })

  it("words the summary from the run alone", () => {
    expect(fillSummary({ from: 0, rules: [], offered: false, declined: false }, "end")).toBe(
      `Filled until the store refused new data: nothing the order allows could make room. ${STORE_FULL}.`,
    )
    expect(fillSummary({ from: 0, rules: [1], offered: false, declined: true }, "stopped")).toBe(
      "Filling stopped: space ran short, so rule 1 freed room; a regional map was not kept, so your history stayed. Pour again, or FILL IT to go on.",
    )
  })

  it("resets to a fresh store for the same device", () => {
    const full = storeMapReducer(initialStoreMap("old-phone"), { type: "fill", whole: true })
    const reset = storeMapReducer(full, { type: "reset" })
    expect(reset.store).toEqual(createStore("old-phone"))
    expect(reset.pours).toBe(0)
    expect(reset.log).toEqual([])
    expect(reset.last).toBeNull()
    expect(reset.message).toBe("Store reset.")
    expect(storeMapReducer(reset, { type: "reset" }).message).toBe("Again: Store reset.")
  })

  it("keeps the free log short", () => {
    const full = storeMapReducer(initialStoreMap("laptop"), { type: "fill", whole: true })
    expect(full.log.length).toBeGreaterThan(0)
    expect(full.log.length).toBeLessThanOrEqual(LOG_LIMIT)
    expect(full.log[full.log.length - 1]).toContain("refused: store full")
  })
})
