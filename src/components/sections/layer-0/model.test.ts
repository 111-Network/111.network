import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CARDS, DRAWERS, DRAWER_IDS, GRADES, type CatalogCard } from "./catalog"
import {
  CALL_SLIP_STEPS,
  DRAWER_COLUMNS,
  GRADE_NOTES,
  INITIAL_ARCHIVE_STATE,
  SEARCH_QUERY,
  archiveReducer,
  cardPath,
  drawerKeyTarget,
  evidenceFor,
  gradeWords,
  indexLine,
  narrate,
  needsReveal,
  searchCatalog,
  type ArchiveState,
} from "./model"

const graded = CARDS.filter((c) => c.grade !== null)
const byId = (id: string): CatalogCard => {
  const card = CARDS.find((c) => c.id === id)
  if (!card) throw new Error(`no card ${id}`)
  return card
}

describe("drawers", () => {
  it("are the six fronts of the plan, in order", () => {
    expect(DRAWERS.map((d) => d.label)).toEqual(["PROJECTS", "DEVICES", "RECIPES", "PROTOCOLS", "LOCAL MODELS", "CONCEPTS"])
    expect(DRAWERS.map((d) => d.id)).toEqual([...DRAWER_IDS])
  })

  it("each deal at least one card", () => {
    for (const d of DRAWERS) expect(CARDS.some((c) => c.drawer === d.id)).toBe(true)
  })
})

describe("cards", () => {
  it("have unique ids and resolvable links that never point at themselves", () => {
    const ids = new Set(CARDS.map((c) => c.id))
    expect(ids.size).toBe(CARDS.length)
    for (const c of CARDS) {
      for (const link of c.links) {
        expect(ids.has(link), `${c.id} -> ${link}`).toBe(true)
        expect(link).not.toBe(c.id)
      }
    }
  })

  it("carry a one-line summary of at most 12 words and at most three lowercase tags", () => {
    for (const c of CARDS) {
      expect(c.summary.split(/\s+/).length, c.id).toBeLessThanOrEqual(12)
      expect(c.summary).not.toMatch(/[\n|]/)
      expect(c.tags.length).toBeGreaterThan(0)
      expect(c.tags.length).toBeLessThanOrEqual(3)
      for (const t of c.tags) expect(t).toMatch(/^[a-z]+$/)
    }
  })

  it("fill every field of the note record", () => {
    for (const c of CARDS) {
      expect(c.what.length, c.id).toBeGreaterThan(0)
      expect(c.useWhen.length, c.id).toBeGreaterThan(0)
      expect(c.doNotUseWhen.length, c.id).toBeGreaterThan(0)
    }
  })

  it("are role names, never product or tech names (copy denylist)", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), "scripts/copy-denylist.json"), "utf8")) as {
      names: (string | { term: string })[]
    }
    const names = config.names.map((n) => (typeof n === "string" ? n : n.term).toLowerCase())
    for (const c of CARDS) {
      const text = [c.title, c.summary, c.what, ...c.useWhen, ...c.doNotUseWhen, ...c.tags].join(" ").toLowerCase()
      for (const name of names) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        expect(new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text), `${c.id} names "${name}"`).toBe(false)
      }
    }
  })

  it("name the radio device in the W5 plain words, the same as every other section", () => {
    const text = JSON.stringify(CARDS).toLowerCase()
    expect(text).not.toMatch(/radio box/)
    expect(byId("radio-box").title).toBe("Small box with a radio")
    expect(byId("flash-mesh-firmware").title).toContain("small box with a radio")
  })

  it("use plain mechanism words, not algorithm or standard terms (W1)", () => {
    const text = JSON.stringify(CARDS).toLowerCase()
    expect(text).not.toMatch(/flood/)
    expect(text).not.toMatch(/bundle/)
    expect(text).not.toMatch(/delay-tolerant/)
  })

  it("use only the safe glyph set for marks (no ■ □ ▸ ◐ ✓)", () => {
    const text = JSON.stringify(CARDS)
    expect(text).not.toMatch(/[■□▪▫▸◂◐◑✓✗★☐☑]/u)
  })
})

describe("grades", () => {
  it("are exactly three, with a legend line each", () => {
    expect([...GRADES]).toEqual(["candidate", "testing", "proven"])
    expect(Object.keys(GRADE_NOTES).sort()).toEqual([...GRADES].sort())
  })

  it("put the reputation ceiling on proven, never on a lower grade", () => {
    expect(GRADE_NOTES.proven).toMatch(/reputation alone never earns it/i)
    expect(GRADE_NOTES.candidate).not.toMatch(/reputation/i)
    expect(GRADE_NOTES.testing).not.toMatch(/reputation/i)
  })

  it("enter research alone as candidate and ask our own bench test for testing", () => {
    expect(GRADE_NOTES.candidate).toMatch(/desk research only/i)
    expect(GRADE_NOTES.testing).toMatch(/our own bench test/i)
    expect(GRADE_NOTES.proven).toMatch(/our own field log/i)
  })

  it("concepts carry no grade; every other card carries one", () => {
    for (const c of CARDS) {
      if (c.drawer === "concepts") expect(c.grade, c.id).toBeNull()
      else expect(c.grade, c.id).not.toBeNull()
    }
  })

  it("form an honest sample: exactly one proven card, labelled example", () => {
    const proven = CARDS.filter((c) => c.grade === "proven")
    expect(proven).toHaveLength(1)
    expect(proven[0]?.example).toBe(true)
    expect(CARDS.filter((c) => c.example)).toEqual(proven)
  })

  it("form an honest sample: most cards candidate, a few testing", () => {
    const candidate = graded.filter((c) => c.grade === "candidate").length
    const testing = graded.filter((c) => c.grade === "testing").length
    expect(candidate).toBeGreaterThan(graded.length / 2)
    expect(testing).toBeGreaterThanOrEqual(2)
    expect(testing).toBeLessThanOrEqual(3)
    expect(testing).toBeLessThan(candidate)
  })
})

describe("evidenceFor", () => {
  const earned = (grade: Parameters<typeof evidenceFor>[0]) =>
    evidenceFor(grade)
      .filter((e) => e.earned)
      .map((e) => e.label)

  it("lists alternatives compared / bench test / field log, checked only where earned", () => {
    expect(evidenceFor("candidate").map((e) => e.label)).toEqual(["alternatives compared", "bench test", "field log"])
    expect(earned("candidate")).toEqual(["alternatives compared"])
    expect(earned("testing")).toEqual(["alternatives compared", "bench test"])
    expect(earned("proven")).toEqual(["alternatives compared", "bench test", "field log"])
  })

  it("gives concepts no evidence row", () => {
    expect(evidenceFor(null)).toEqual([])
  })

  it("only proven earns the field log", () => {
    for (const c of graded) {
      const field = evidenceFor(c.grade).find((e) => e.kind === "field")
      expect(field?.earned, c.id).toBe(c.grade === "proven")
    }
  })
})

describe("index view", () => {
  it("prints one line per note in the fixed grammar", () => {
    expect(indexLine(byId("radio-box"))).toBe(
      "- [Small box with a radio](devices/radio-box): Cheap long-range radio board; reflashing switches which mesh it speaks. | testing | hardware,mesh,radio",
    )
  })

  it("puts concept in the grade slot", () => {
    expect(indexLine(byId("four-delivery-states"))).toMatch(/ \| concept \| /)
  })

  it("never wraps: every line is a single line", () => {
    for (const c of CARDS) expect(indexLine(c)).not.toMatch(/\n/)
  })

  it("names grades in plain words", () => {
    expect(gradeWords(byId("long-range-mesh-firmware"))).toBe("proven, example")
    expect(gradeWords(byId("radio-box"))).toBe("testing")
    expect(gradeWords(byId("adopt-before-build"))).toBe("concept, no grade")
  })
})

describe("search slot", () => {
  it("prints the call slip READ INDEX → SEARCH \"radio\" → OPEN ONE → STOP", () => {
    expect(SEARCH_QUERY).toBe("radio")
    expect(CALL_SLIP_STEPS.join(" → ")).toBe('READ INDEX → SEARCH "radio" → OPEN ONE → STOP')
  })

  it("matches index lines, ranks path matches first, and opens exactly one", () => {
    const result = searchCatalog(CARDS, SEARCH_QUERY)
    expect(result.hits.length).toBeGreaterThan(1)
    for (const id of result.hits) expect(indexLine(byId(id)).toLowerCase()).toContain("radio")
    expect(result.opened?.id).toBe("radio-box")
    expect(result.hits[0]).toBe("radio-box")
    expect(cardPath(byId(result.hits[0] ?? ""))).toContain("radio")
  })

  it("spans several drawers", () => {
    const drawers = new Set(searchCatalog(CARDS, SEARCH_QUERY).hits.map((id) => byId(id).drawer))
    expect(drawers.size).toBeGreaterThan(1)
  })

  it("opens nothing when nothing matches", () => {
    expect(searchCatalog(CARDS, "zzz-no-such-word")).toEqual({ query: "zzz-no-such-word", hits: [], opened: null })
    expect(searchCatalog(CARDS, "  ").opened).toBeNull()
  })
})

describe("archiveReducer", () => {
  const s0 = INITIAL_ARCHIVE_STATE

  it("starts on the PROJECTS drawer with the proven example open, full note, no slip, no motion", () => {
    expect(s0).toMatchObject({ drawer: "projects", view: "human", slip: null, deal: 0, pull: 0, event: "init" })
    const card = byId(s0.card ?? "")
    expect(card.drawer).toBe(s0.drawer)
    expect(card.grade).toBe("proven")
  })

  it("pulling another drawer deals its cards and closes the note", () => {
    const s1 = archiveReducer(s0, { type: "openDrawer", drawer: "devices" })
    expect(s1).toMatchObject({ drawer: "devices", card: null, deal: 1, pull: 0, event: "drawer" })
  })

  it("pulling the open drawer again changes nothing", () => {
    expect(archiveReducer(s0, { type: "openDrawer", drawer: "projects" })).toBe(s0)
  })

  it("opening a card of the open drawer opens its note without re-dealing", () => {
    const s1 = archiveReducer(s0, { type: "openCard", drawer: "projects", card: "offline-merge-library" })
    expect(s1).toMatchObject({ drawer: "projects", card: "offline-merge-library", deal: 0, pull: 1, event: "card" })
    expect(archiveReducer(s1, { type: "openCard", drawer: "projects", card: "offline-merge-library" })).toBe(s1)
  })

  it("following a link into another drawer opens that drawer and the note", () => {
    const s1 = archiveReducer(s0, { type: "openCard", drawer: "devices", card: "radio-box" })
    expect(s1).toMatchObject({ drawer: "devices", card: "radio-box", deal: 1, pull: 1 })
  })

  it("keeps the open note inside the open drawer", () => {
    let s: ArchiveState = s0
    s = archiveReducer(s, { type: "openDrawer", drawer: "concepts" })
    s = archiveReducer(s, { type: "openCard", drawer: "concepts", card: "radio-airtime-budget" })
    s = archiveReducer(s, { type: "openCard", drawer: "devices", card: "radio-box" })
    s = archiveReducer(s, { type: "openDrawer", drawer: "recipes" })
    expect(s.card).toBeNull()
    s = archiveReducer(s, { type: "openCard", drawer: "recipes", card: "phone-over-usb" })
    expect(byId(s.card ?? "").drawer).toBe(s.drawer)
  })

  it("HUMAN │ AGENT swaps the view and keeps the note", () => {
    const s1 = archiveReducer(s0, { type: "setView", view: "agent" })
    expect(s1).toMatchObject({ view: "agent", card: s0.card, drawer: s0.drawer, event: "view" })
    expect(archiveReducer(s1, { type: "setView", view: "agent" })).toBe(s1)
    expect(archiveReducer(s1, { type: "setView", view: "human" }).view).toBe("human")
  })

  it("the search slot prints the slip and opens the one note it found", () => {
    const result = searchCatalog(CARDS, SEARCH_QUERY)
    const opened = result.opened
    if (!opened) throw new Error("expected a hit")
    const s1 = archiveReducer(s0, {
      type: "printSlip",
      query: result.query,
      hits: result.hits,
      opened: { drawer: opened.drawer, card: opened.id },
    })
    expect(s1.slip).toEqual({ query: "radio", hits: result.hits, opened: "radio-box" })
    expect(s1).toMatchObject({ drawer: "devices", card: "radio-box", deal: 1, pull: 1, event: "search" })

    // Printing again re-prints the same slip; nothing is re-dealt.
    const s2 = archiveReducer(s1, {
      type: "printSlip",
      query: result.query,
      hits: result.hits,
      opened: { drawer: opened.drawer, card: opened.id },
    })
    expect(s2).toMatchObject({ drawer: "devices", card: "radio-box", deal: 1, pull: 1 })
  })

  it("a search with no hit prints the slip and leaves the cabinet as it was", () => {
    const s1 = archiveReducer(s0, { type: "printSlip", query: "zzz", hits: [], opened: null })
    expect(s1).toMatchObject({ drawer: s0.drawer, card: s0.card, deal: 0, pull: 0, event: "search" })
    expect(s1.slip).toEqual({ query: "zzz", hits: [], opened: null })
  })
})

describe("drawerKeyTarget", () => {
  const n = DRAWERS.length

  it("steps one drawer with Left/Right and wraps at the ends", () => {
    expect(drawerKeyTarget("ArrowRight", 0, n)).toBe(1)
    expect(drawerKeyTarget("ArrowRight", n - 1, n)).toBe(0)
    expect(drawerKeyTarget("ArrowLeft", 0, n)).toBe(n - 1)
    expect(drawerKeyTarget("ArrowLeft", 3, n)).toBe(2)
  })

  it("steps one row of the 2-column grid with Up/Down, keeping the column", () => {
    expect(DRAWER_COLUMNS).toBe(2)
    expect(drawerKeyTarget("ArrowDown", 0, n)).toBe(2)
    expect(drawerKeyTarget("ArrowDown", 1, n)).toBe(3)
    expect(drawerKeyTarget("ArrowDown", 4, n)).toBe(0)
    expect(drawerKeyTarget("ArrowDown", 5, n)).toBe(1)
    expect(drawerKeyTarget("ArrowUp", 0, n)).toBe(4)
    expect(drawerKeyTarget("ArrowUp", 3, n)).toBe(1)
  })

  it("jumps to the ends with Home/End and leaves every other key to the browser", () => {
    expect(drawerKeyTarget("Home", 4, n)).toBe(0)
    expect(drawerKeyTarget("End", 1, n)).toBe(n - 1)
    for (const key of ["Tab", "Enter", " ", "a", "PageDown"]) expect(drawerKeyTarget(key, 2, n)).toBeNull()
    expect(drawerKeyTarget("ArrowRight", 0, 0)).toBeNull()
  })
})

describe("needsReveal", () => {
  const box = { navOffset: 64, viewportHeight: 667 }

  it("leaves the page still when the head is fully visible below the nav", () => {
    expect(needsReveal({ ...box, top: 200, headBottom: 400 })).toBe(false)
    expect(needsReveal({ ...box, top: 64, headBottom: 667 })).toBe(false)
    expect(needsReveal({ ...box, top: 63.4, headBottom: 667.6 })).toBe(false)
  })

  it("scrolls when the head is below the fold (the stacked tray / note on a phone)", () => {
    expect(needsReveal({ ...box, top: 690, headBottom: 860 })).toBe(true)
    expect(needsReveal({ ...box, top: 600, headBottom: 720 })).toBe(true)
  })

  it("scrolls when the box top is under the nav or above the viewport (a followed link)", () => {
    expect(needsReveal({ ...box, top: 20, headBottom: 120 })).toBe(true)
    expect(needsReveal({ ...box, top: -900, headBottom: -800 })).toBe(true)
  })
})

describe("narrate", () => {
  const say = (s: ArchiveState) => narrate(s, CARDS, DRAWERS)

  it("narrates every transition in one line", () => {
    const s0 = INITIAL_ARCHIVE_STATE
    expect(say(s0)).toBe("PROJECTS drawer. Note open: Long-range mesh firmware, proven, example.")
    const s1 = archiveReducer(s0, { type: "openDrawer", drawer: "models" })
    expect(say(s1)).toBe("LOCAL MODELS drawer open, cards dealt. Pick a card to read its note.")
    const s2 = archiveReducer(s1, { type: "openCard", drawer: "models", card: "model-runtime" })
    expect(say(s2)).toBe("LOCAL MODELS drawer. Note open: Portable model runtime, candidate.")
    expect(say(archiveReducer(s2, { type: "setView", view: "agent" }))).toBe("Agent view: one index line per note.")
    const s3 = archiveReducer(s2, {
      type: "printSlip",
      query: "radio",
      hits: ["radio-box"],
      opened: { drawer: "devices", card: "radio-box" },
    })
    expect(say(s3)).toBe('Call slip printed: read index, search "radio", open one, stop. Opened Small box with a radio.')
    expect(say(archiveReducer(s0, { type: "printSlip", query: "zzz", hits: [], opened: null }))).toBe(
      'Call slip printed. Nothing matched "zzz".',
    )
  })

  it("names concepts as ungraded", () => {
    const s = archiveReducer(INITIAL_ARCHIVE_STATE, { type: "openCard", drawer: "concepts", card: "adopt-before-build" })
    expect(say(s)).toBe("CONCEPTS drawer. Note open: Adopt before build, concept, no grade.")
  })
})
