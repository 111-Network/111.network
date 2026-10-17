// Pure model of the Knowledge base view (React-free, server-safe, tested in node). Real source:
// os/interface/ui/src/lib/markdown.ts (kbRouteTarget, frontmatterRows) + os/knowledge/_meta/schema.md
// (the index line grammar, sections in a fixed order), translated from files into plain data.
//
// The library is the home L0 catalog (the same six drawers, cards and grades) plus the demo-only
// notes in copy/kb.ts that the service pages point at. Drawers are addressed by a route slug: the
// L0 "models" drawer is "local-models" here (the path DEMO_WORLD's Local model service uses), and
// "models" is accepted as an alias.
//
// Both layer-0 imports are plain data and pure functions with no imports of their own (catalog.ts
// imports nothing; model.ts only types from catalog.ts), so no motion or icon package reaches /demo.
import { CARDS, DRAWERS, GRADES, type CatalogCard, type DrawerId, type Grade } from "@/components/sections/layer-0/catalog"
import { evidenceFor, GRADE_NOTES, GRADE_RANK, gradeWords, type EvidenceItem } from "@/components/sections/layer-0/model"
import { KB_COPY, KB_DRAWER_COPY, KB_EXTRA_NOTES } from "../../copy/kb"
import { PATHS, type DemoRoute } from "../../engine/router"
import type { DemoService } from "../../engine/world"

export { evidenceFor, GRADE_NOTES, GRADE_RANK, GRADES, type EvidenceItem, type Grade }

// ------------------------------------------------------------------------------------ drawers

/** Drawer route slugs, in cabinet order (= the knowledge folders). */
export const KB_DRAWER_SLUGS = ["projects", "devices", "recipes", "protocols", "local-models", "concepts"] as const

export type KbDrawerSlug = (typeof KB_DRAWER_SLUGS)[number]

const SLUG_OF: Readonly<Record<DrawerId, KbDrawerSlug>> = {
  projects: "projects",
  devices: "devices",
  recipes: "recipes",
  protocols: "protocols",
  models: "local-models",
  concepts: "concepts",
}

/** One drawer: its route slug, the L0 drawer id, the L0 label plate, a title and a blurb. */
export interface KbDrawer {
  slug: KbDrawerSlug
  id: DrawerId
  /** The L0 label plate, e.g. "LOCAL MODELS". */
  label: string
  /** e.g. "Local models". */
  title: string
  blurb: string
}

/** The six drawers in L0 order. */
export const KB_DRAWERS: readonly KbDrawer[] = DRAWERS.map((d) => ({
  slug: SLUG_OF[d.id],
  id: d.id,
  label: d.label,
  title: KB_DRAWER_COPY[d.id].title,
  blurb: KB_DRAWER_COPY[d.id].blurb,
}))

/** Old spellings that still open a drawer: the L0 folder name of the local models drawer. */
const DRAWER_ALIASES: Readonly<Record<string, KbDrawerSlug>> = { models: "local-models" }

/** A drawer by route slug (or alias); undefined when there is no such drawer. */
export function drawerBySlug(slug: string): KbDrawer | undefined {
  const canonical = DRAWER_ALIASES[slug] ?? slug
  return KB_DRAWERS.find((d) => d.slug === canonical)
}

// -------------------------------------------------------------------------------------- notes

/** One note, as the view reads it. */
export interface KbNote {
  /** Vault-wide unique slug, e.g. "thin-bridge". */
  id: string
  drawer: KbDrawerSlug
  /** Role name or idea, never a product name. */
  title: string
  /** Evidence grade; null for a concept. */
  grade: Grade | null
  /** Set only on the one proven sample card (shown with an "example" tag). */
  example: boolean
  /** The one-line verdict (at most 12 words); also the first line of the note's body. */
  summary: string
  tags: readonly string[]
  what: string
  useWhen: readonly string[]
  doNotUseWhen: readonly string[]
  /** The optional Details section (a recipe's steps, a concept's fine print). */
  details: readonly string[]
  /** Linked note ids. */
  links: readonly string[]
  /** "drawer/note", the note's address in the library (and in DemoService.kb). */
  path: string
}

type SourceCard = CatalogCard & { details?: readonly string[] }

function toNote(card: SourceCard): KbNote {
  const drawer = SLUG_OF[card.drawer]
  return {
    id: card.id,
    drawer,
    title: card.title,
    grade: card.grade,
    example: card.example === true,
    summary: card.summary,
    tags: card.tags,
    what: card.what,
    useWhen: card.useWhen,
    doNotUseWhen: card.doNotUseWhen,
    details: card.details ?? [],
    links: card.links,
    path: `${drawer}/${card.id}`,
  }
}

const byDrawerThenSlug = (a: KbNote, b: KbNote): number =>
  KB_DRAWER_SLUGS.indexOf(a.drawer) - KB_DRAWER_SLUGS.indexOf(b.drawer) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Every note: drawers in cabinet order, notes by slug inside each (the real index's order). */
export const KB_NOTES: readonly KbNote[] = [...CARDS, ...KB_EXTRA_NOTES].map(toNote).sort(byDrawerThenSlug)

const NOTE_BY_ID: ReadonlyMap<string, KbNote> = new Map(KB_NOTES.map((n) => [n.id, n]))

const NOTES_BY_DRAWER: ReadonlyMap<KbDrawerSlug, readonly KbNote[]> = new Map(
  KB_DRAWER_SLUGS.map((slug) => [slug, KB_NOTES.filter((n) => n.drawer === slug)]),
)

/** A note by id, whatever drawer it is in. */
export function noteById(id: string): KbNote | undefined {
  return NOTE_BY_ID.get(id)
}

/** The notes of one drawer, by slug (a stable array). */
export function notesIn(drawer: KbDrawerSlug): readonly KbNote[] {
  return NOTES_BY_DRAWER.get(drawer) ?? []
}

/** The notes a note links to, in its own order (unknown ids are skipped). */
export function linkedNotes(note: KbNote): KbNote[] {
  return note.links.flatMap((id) => {
    const target = NOTE_BY_ID.get(id)
    return target ? [target] : []
  })
}

/** The in-demo route of a note: `/kb/<drawer>/<note>`. */
export function noteRoute(note: Pick<KbNote, "drawer" | "id">): string {
  return PATHS.kbNote(note.drawer, note.id)
}

/** The grade as plain words, e.g. "proven, example" or "concept, no grade" (L0 `gradeWords`). */
export function noteGradeWords(note: Pick<KbNote, "grade" | "example">): string {
  return gradeWords({ grade: note.grade, example: note.example ? true : undefined })
}

/** Tags as the index line prints them: sorted, at most three (real line grammar). */
export function indexTags(note: Pick<KbNote, "tags">): string {
  return [...note.tags].sort().slice(0, 3).join(",")
}

/**
 * The agent's one-line index view of a note, in the fixed line grammar
 * `- [title](path): summary | grade | tags` ("concept" in the grade slot).
 */
export function indexLine(note: KbNote): string {
  return `- [${note.title}](${note.path}): ${note.summary} | ${note.grade ?? "concept"} | ${indexTags(note)}`
}

/** Services whose recipe points at this note (DemoService.kb === note.path), in registry order. */
export function usedBy(services: readonly DemoService[], note: Pick<KbNote, "path">): DemoService[] {
  return services.filter((s) => s.kb === note.path)
}

// -------------------------------------------------------------------------------------- pages

/** What a kb route shows. */
export type KbPage =
  | { kind: "index" }
  | { kind: "drawer"; drawer: KbDrawer }
  | { kind: "note"; drawer: KbDrawer; note: KbNote }
  /** "/kb/<x>" where x is no drawer. */
  | { kind: "no-drawer"; slug: string }
  /** "/kb/<drawer>/<x>" where x is no note at all. */
  | { kind: "no-note"; drawer: KbDrawer; slug: string }
  /** "/kb/<drawer>/<note>" where the note exists but is filed in another drawer. */
  | { kind: "elsewhere"; drawer: KbDrawer; note: KbNote }

/** The page a route opens (real `kbRouteTarget` + the 404 cases, in plain words). */
export function kbPageOf(route: DemoRoute): KbPage {
  if (route.view === "kb-drawer") {
    const drawer = drawerBySlug(route.drawer)
    return drawer ? { kind: "drawer", drawer } : { kind: "no-drawer", slug: route.drawer }
  }
  if (route.view === "kb-note") {
    const drawer = drawerBySlug(route.drawer)
    if (!drawer) return { kind: "no-drawer", slug: route.drawer }
    const note = noteById(route.note)
    if (!note) return { kind: "no-note", drawer, slug: route.note }
    return note.drawer === drawer.slug ? { kind: "note", drawer, note } : { kind: "elsewhere", drawer, note }
  }
  return { kind: "index" }
}

/** The drawer a page belongs to (for the drawer fronts), or null. */
export function pageDrawer(page: KbPage): KbDrawerSlug | null {
  return page.kind === "drawer" || page.kind === "note" || page.kind === "no-note" ? page.drawer.slug : null
}

/** Stable key of a page: focus moves to the new title when it changes after an in-view link. */
export function pageKey(page: KbPage): string {
  switch (page.kind) {
    case "index":
      return "index"
    case "drawer":
      return `drawer:${page.drawer.slug}`
    case "note":
      return `note:${page.note.path}`
    case "no-drawer":
      return `no-drawer:${page.slug}`
    case "no-note":
      return `no-note:${page.drawer.slug}/${page.slug}`
    case "elsewhere":
      return `elsewhere:${page.drawer.slug}/${page.note.id}`
  }
}

// ------------------------------------------------------------------------------------ finding

/** The words of a find text: lowercase, split on whitespace, empty words dropped. */
export function queryTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((t) => t !== "")
}

/** Everything a find word may match: title, summary, tags, path and the drawer's names. */
function haystack(note: KbNote): string {
  const drawer = drawerBySlug(note.drawer)
  return [note.title, note.summary, note.tags.join(" "), note.path, drawer?.label ?? "", drawer?.title ?? ""].join(" ").toLowerCase()
}

const HAYSTACK: ReadonlyMap<string, string> = new Map(KB_NOTES.map((n) => [n.id, haystack(n)]))

/** True when every word occurs in the note (case-insensitive). No words = every note. */
export function matchesTerms(note: KbNote, terms: readonly string[]): boolean {
  const text = HAYSTACK.get(note.id) ?? haystack(note)
  return terms.every((t) => text.includes(t))
}

export interface FindResult {
  terms: readonly string[]
  /** Every matching note, in index order. Every note when there are no words. */
  hits: readonly KbNote[]
  /**
   * The one note the agent would open (READ INDEX -> SEARCH -> OPEN ONE -> STOP): the first hit whose
   * path names a word, else the first hit. Null with no words or no hits.
   */
  opened: KbNote | null
}

/** Filter the library by a find text (L0 `searchCatalog`, with every word required). */
export function findNotes(query: string, notes: readonly KbNote[] = KB_NOTES): FindResult {
  const terms = queryTerms(query)
  if (terms.length === 0) return { terms, hits: notes, opened: null }
  const hits = notes.filter((n) => matchesTerms(n, terms))
  const opened = hits.find((n) => terms.some((t) => n.path.includes(t))) ?? hits[0] ?? null
  return { terms, hits, opened }
}

/** How many of `hits` sit in each drawer. */
export function hitsPerDrawer(hits: readonly KbNote[]): ReadonlyMap<KbDrawerSlug, number> {
  const counts = new Map<KbDrawerSlug, number>(KB_DRAWER_SLUGS.map((s) => [s, 0]))
  for (const n of hits) counts.set(n.drawer, (counts.get(n.drawer) ?? 0) + 1)
  return counts
}

/** The notes a library page lists: every hit on the index, the open drawer's hits on a drawer page. */
export function pageNotes(page: KbPage, find: FindResult): readonly KbNote[] {
  if (page.kind === "index") return find.hits
  if (page.kind === "drawer") return find.hits.filter((n) => n.drawer === page.drawer.slug)
  return []
}

/** Notes grouped by drawer, in cabinet order; drawers with no note are left out. */
export function groupByDrawer(notes: readonly KbNote[]): { drawer: KbDrawer; notes: readonly KbNote[] }[] {
  return KB_DRAWERS.flatMap((drawer) => {
    const inDrawer = notes.filter((n) => n.drawer === drawer.slug)
    return inDrawer.length > 0 ? [{ drawer, notes: inDrawer }] : []
  })
}

/** What the drawer fronts print: each drawer's note count, or its match count while a find runs. */
export function frontCounts(find: FindResult): ReadonlyMap<KbDrawerSlug, number> {
  return find.terms.length > 0 ? hitsPerDrawer(find.hits) : hitsPerDrawer(KB_NOTES)
}

/**
 * The one sentence a find leaves on a library page (printed under the fronts and announced): how
 * many notes the page lists, or that none matches. `query` is the text as typed.
 */
export function findSentence(page: KbPage, find: FindResult, query: string): string {
  const n = pageNotes(page, find).length
  const q = query.trim()
  const drawer = page.kind === "drawer" ? page.drawer : null
  if (find.terms.length === 0) return drawer ? KB_COPY.find.inDrawer(n, drawer.title) : KB_COPY.find.all(n)
  if (n === 0) return drawer ? KB_COPY.find.noneHere(q, drawer.title) : KB_COPY.find.none(q)
  return KB_COPY.find.results(n)
}
