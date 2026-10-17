// The Knowledge base model: the same six drawers, cards and grades as the home L0 section, every
// note a service page points at, the agent's index grammar, the routes and the find rules.
import { describe, expect, it } from "vitest"
import { CARDS } from "@/components/sections/layer-0/catalog"
import { KB_COPY, KB_EXTRA_NOTES } from "../../copy/kb"
import { parsePath, PATHS } from "../../engine/router"
import { DEMO_WORLD } from "../../engine/world"
import {
  drawerBySlug,
  evidenceFor,
  findNotes,
  findSentence,
  frontCounts,
  groupByDrawer,
  indexLine,
  KB_DRAWER_SLUGS,
  KB_DRAWERS,
  KB_NOTES,
  kbPageOf,
  linkedNotes,
  noteById,
  noteGradeWords,
  noteRoute,
  notesIn,
  pageDrawer,
  pageKey,
  pageNotes,
  usedBy,
  type KbPage,
} from "./model"

const page = (path: string): KbPage => kbPageOf(parsePath(path))
const words = (s: string) => s.split(/\s+/).filter(Boolean).length

describe("drawers", () => {
  it("are the six L0 drawers, in cabinet order, with the L0 label plates", () => {
    expect(KB_DRAWERS.map((d) => d.label)).toEqual(["PROJECTS", "DEVICES", "RECIPES", "PROTOCOLS", "LOCAL MODELS", "CONCEPTS"])
    expect(KB_DRAWERS.map((d) => d.slug)).toEqual([...KB_DRAWER_SLUGS])
    for (const d of KB_DRAWERS) {
      expect(d.title).not.toBe("")
      expect(d.blurb).not.toBe("")
    }
  })

  it("open by slug, and the L0 folder name 'models' still opens Local models", () => {
    expect(drawerBySlug("local-models")?.label).toBe("LOCAL MODELS")
    expect(drawerBySlug("models")?.slug).toBe("local-models")
    expect(drawerBySlug("Projects")).toBeUndefined()
    expect(drawerBySlug("nope")).toBeUndefined()
  })

  it("every drawer holds at least one note; notes are grouped in cabinet order", () => {
    for (const slug of KB_DRAWER_SLUGS) expect(notesIn(slug).length).toBeGreaterThan(0)
    expect(groupByDrawer(KB_NOTES).map((g) => g.drawer.slug)).toEqual([...KB_DRAWER_SLUGS])
    expect(groupByDrawer(notesIn("concepts")).map((g) => g.drawer.slug)).toEqual(["concepts"])
    expect(groupByDrawer([])).toEqual([])
  })
})

describe("notes", () => {
  it("carry every L0 card with its title and grade, plus the demo's own notes", () => {
    for (const card of CARDS) {
      const note = noteById(card.id)
      expect(note?.title).toBe(card.title)
      expect(note?.grade).toBe(card.grade)
    }
    expect(KB_NOTES).toHaveLength(CARDS.length + KB_EXTRA_NOTES.length)
    expect(new Set(KB_NOTES.map((n) => n.id)).size).toBe(KB_NOTES.length)
  })

  it("provide every note a service page points at (DEMO_WORLD.services[].kb)", () => {
    const paths = DEMO_WORLD.services.flatMap((s) => (s.kb ? [s.kb] : []))
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) {
      const target = page(`/kb/${p}`)
      expect({ p, kind: target.kind }).toEqual({ p, kind: "note" })
      if (target.kind === "note") expect(target.note.path).toBe(p)
    }
  })

  it("follow the note rules: short summaries, at most three lowercase tags, links that resolve", () => {
    for (const n of KB_NOTES) {
      expect({ id: n.id, words: words(n.summary) <= 12 }).toEqual({ id: n.id, words: true })
      expect(n.tags.length).toBeGreaterThan(0)
      expect(n.tags.length).toBeLessThanOrEqual(3)
      for (const t of n.tags) expect(t).toMatch(/^[a-z-]+$/)
      for (const l of n.links) expect({ from: n.id, to: l, ok: noteById(l) !== undefined }).toEqual({ from: n.id, to: l, ok: true })
      expect(linkedNotes(n)).toHaveLength(n.links.length)
      expect(n.what).not.toBe("")
      expect(n.useWhen.length).toBeGreaterThan(0)
      expect(n.doNotUseWhen.length).toBeGreaterThan(0)
      expect(n.path).toBe(`${n.drawer}/${n.id}`)
    }
  })

  it("grade honestly: concepts carry none, mostly candidate or testing, one proven example only", () => {
    for (const n of KB_NOTES) expect({ id: n.id, ungraded: n.grade === null }).toEqual({ id: n.id, ungraded: n.drawer === "concepts" })
    const graded = KB_NOTES.filter((n) => n.grade !== null)
    const proven = graded.filter((n) => n.grade === "proven")
    expect(proven.map((n) => n.id)).toEqual(["long-range-mesh-firmware"])
    expect(proven[0]?.example).toBe(true)
    expect(KB_NOTES.filter((n) => n.example)).toHaveLength(1)
    expect(graded.filter((n) => n.grade === "candidate" || n.grade === "testing").length).toBeGreaterThan(graded.length * 0.8)
    expect(KB_EXTRA_NOTES.every((n) => n.grade !== "proven")).toBe(true)
  })

  it("print no tally of proven notes anywhere in the view's copy", () => {
    const text = JSON.stringify(KB_COPY)
    expect(text).not.toMatch(/proven/i)
    expect(KB_COPY.drawers.count(3)).toBe("3 notes")
  })

  it("grade words and evidence follow L0: checked only where the grade earned it", () => {
    expect(noteGradeWords(noteById("long-range-mesh-firmware")!)).toBe("proven, example")
    expect(noteGradeWords(noteById("radio-box")!)).toBe("testing")
    expect(noteGradeWords(noteById("thin-bridge")!)).toBe("concept, no grade")
    expect(evidenceFor(null)).toEqual([])
    expect(evidenceFor("candidate").map((e) => e.earned)).toEqual([true, false, false])
    expect(evidenceFor("testing").map((e) => e.earned)).toEqual([true, true, false])
    expect(evidenceFor("proven").map((e) => e.earned)).toEqual([true, true, true])
  })

  it("the agent's index line uses the fixed grammar, 'concept' in the grade slot, tags sorted", () => {
    expect(indexLine(noteById("radio-box")!)).toBe(
      "- [Small box with a radio](devices/radio-box): Cheap long-range radio board; reflashing switches which mesh it speaks. | testing | hardware,mesh,radio",
    )
    expect(indexLine(noteById("thin-bridge")!)).toMatch(/^- \[Thin bridge\]\(concepts\/thin-bridge\): .+ \| concept \| bridge,transport$/)
  })

  it("know which services point at them", () => {
    expect(usedBy(DEMO_WORLD.services, noteById("thin-bridge")!).map((s) => s.id)).toEqual(["bridge"])
    expect(usedBy(DEMO_WORLD.services, noteById("small-local-model")!).map((s) => s.id)).toEqual(["model"])
    expect(usedBy(DEMO_WORLD.services, noteById("old-phone")!)).toEqual([])
  })
})

describe("pages", () => {
  it("map the three deep links (#/kb, #/kb/<drawer>, #/kb/<drawer>/<note>)", () => {
    expect(page(PATHS.kb)).toEqual({ kind: "index" })
    const drawer = page(PATHS.kbDrawer("concepts"))
    expect(drawer.kind === "drawer" && drawer.drawer.slug).toBe("concepts")
    const note = page(PATHS.kbNote("concepts", "thin-bridge"))
    expect(note.kind === "note" && note.note.title).toBe("Thin bridge")
    const alias = page("/kb/models/small-local-model")
    expect(alias.kind === "note" && alias.drawer.slug).toBe("local-models")
    for (const n of KB_NOTES) expect(page(noteRoute(n)).kind).toBe("note")
  })

  it("have honest not-found cases", () => {
    expect(page("/kb/attic")).toEqual({ kind: "no-drawer", slug: "attic" })
    expect(page("/kb/attic/thin-bridge")).toEqual({ kind: "no-drawer", slug: "attic" })
    const missing = page("/kb/concepts/nope")
    expect(missing.kind === "no-note" && missing.slug).toBe("nope")
    const elsewhere = page("/kb/projects/thin-bridge")
    expect(elsewhere.kind === "elsewhere" && elsewhere.note.drawer).toBe("concepts")
  })

  it("name the open drawer and get distinct keys (focus moves when the key changes)", () => {
    expect(pageDrawer(page(PATHS.kb))).toBeNull()
    expect(pageDrawer(page(PATHS.kbDrawer("recipes")))).toBe("recipes")
    expect(pageDrawer(page(PATHS.kbNote("recipes", "set-up-a-radio-board")))).toBe("recipes")
    const keys = [PATHS.kb, PATHS.kbDrawer("recipes"), PATHS.kbNote("recipes", "set-up-a-radio-board"), "/kb/attic", "/kb/recipes/nope"].map((p) =>
      pageKey(page(p)),
    )
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("find", () => {
  it("with no words lists every note and opens nothing", () => {
    const r = findNotes("   ")
    expect(r.terms).toEqual([])
    expect(r.hits).toBe(KB_NOTES)
    expect(r.opened).toBeNull()
  })

  it("matches every word, case-insensitive, over titles, summaries, tags, paths and drawer names", () => {
    const radio = findNotes("RADIO")
    expect(radio.hits.length).toBeGreaterThan(1)
    expect(radio.hits.every((n) => indexLine(n).toLowerCase().includes("radio") || n.path.includes("radio"))).toBe(true)
    const both = findNotes("radio install")
    expect(both.hits.map((n) => n.id).sort()).toEqual(["flash-mesh-firmware", "set-up-a-radio-board"])
    expect(findNotes("concepts").hits.every((n) => n.drawer === "concepts")).toBe(true)
    expect(findNotes("zzzz").hits).toEqual([])
  })

  it("opens ONE note: the first hit whose path names a word, else the first hit (READ INDEX -> SEARCH -> OPEN ONE -> STOP)", () => {
    expect(findNotes("radio").opened?.path).toBe("devices/radio-box")
    expect(findNotes("gateway").opened?.path).toBe("concepts/gateway-role")
    expect(findNotes("zzzz").opened).toBeNull()
  })

  it("lists the page's notes, counts per drawer for the fronts, and says one sentence", () => {
    const index = page(PATHS.kb)
    const concepts = page(PATHS.kbDrawer("concepts"))
    const all = findNotes("")
    expect(pageNotes(index, all)).toBe(KB_NOTES)
    expect(pageNotes(concepts, all)).toEqual(notesIn("concepts"))
    expect(frontCounts(all).get("concepts")).toBe(notesIn("concepts").length)
    expect(findSentence(index, all, "")).toBe(`${KB_NOTES.length} notes in six drawers.`)
    expect(findSentence(concepts, all, "")).toBe(`${notesIn("concepts").length} notes in the Concepts drawer.`)

    const phone = findNotes("phone")
    expect(frontCounts(phone).get("devices")).toBe(phone.hits.filter((n) => n.drawer === "devices").length)
    expect(frontCounts(phone).get("local-models")).toBe(0)
    expect(findSentence(index, phone, "phone")).toBe(`${phone.hits.length} notes match.`)
    expect(findSentence(page(PATHS.kbDrawer("local-models")), phone, " phone ")).toBe('No note in the Local models drawer matches "phone".')
    expect(findSentence(index, findNotes("zzzz"), "zzzz")).toBe('No note matches "zzzz".')
    expect(pageNotes(page(PATHS.kbNote("concepts", "thin-bridge")), phone)).toEqual([])
  })
})
