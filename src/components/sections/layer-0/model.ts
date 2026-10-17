import type { CatalogCard, Drawer, DrawerId, Grade } from "./catalog"

// Pure state machine and derivations of the L0 "Archive Drawers" widget
// (plan §5 L0). React-free and data-free (types only from catalog.ts), so the
// client island bundles none of the catalog: the server passes it as props.

// ---- grades and evidence ---------------------------------------------------

/** Rank of each grade; a higher grade has earned everything below it. */
export const GRADE_RANK: Readonly<Record<Grade, number>> = { candidate: 0, testing: 1, proven: 2 }

/**
 * Legend line per grade. Research alone enters as candidate; testing needs our
 * own bench test; the reputation ceiling sits on proven, where it is true
 * without contradiction (only our own field log earns it).
 */
export const GRADE_NOTES: Readonly<Record<Grade, string>> = {
  candidate: "Desk research only. Alternatives compared.",
  testing: "Passes our own bench test.",
  proven: "Our own field log. The default choice. Reputation alone never earns it.",
}

/** The three kinds of evidence a note can earn. */
export type EvidenceKind = "alternatives" | "bench" | "field"

/** One evidence line of a note record. */
export interface EvidenceItem {
  kind: EvidenceKind
  label: string
  /** True only when the note's grade earned it. */
  earned: boolean
}

const EVIDENCE: readonly { kind: EvidenceKind; label: string; from: Grade }[] = [
  { kind: "alternatives", label: "alternatives compared", from: "candidate" },
  { kind: "bench", label: "bench test", from: "testing" },
  { kind: "field", label: "field log", from: "proven" },
]

/**
 * The Evidence row of a note: candidate earns "alternatives compared", testing
 * adds "bench test", proven adds "field log". Concepts (null) carry none.
 */
export function evidenceFor(grade: Grade | null): readonly EvidenceItem[] {
  if (grade === null) return []
  return EVIDENCE.map(({ kind, label, from }) => ({ kind, label, earned: GRADE_RANK[grade] >= GRADE_RANK[from] }))
}

/** The grade as plain words, e.g. "proven, example" or "concept, no grade". */
export function gradeWords(card: Pick<CatalogCard, "grade" | "example">): string {
  if (card.grade === null) return "concept, no grade"
  return card.example ? `${card.grade}, example` : card.grade
}

// ---- index -----------------------------------------------------------------

/** Where a note lives, e.g. "devices/radio-box". */
export function cardPath(card: Pick<CatalogCard, "drawer" | "id">): string {
  return `${card.drawer}/${card.id}`
}

/**
 * The agent's one-line index view of a note, in the fixed line grammar
 * `- [title](path): summary | grade | tags` ("concept" in the grade slot).
 */
export function indexLine(card: CatalogCard): string {
  return `- [${card.title}](${cardPath(card)}): ${card.summary} | ${card.grade ?? "concept"} | ${card.tags.join(",")}`
}

// ---- search slot -----------------------------------------------------------

/** The one query the search slot runs. */
export const SEARCH_QUERY = "radio"

/** The call slip, printed whole: the agent's retrieval ritual. */
export const CALL_SLIP_STEPS = ["READ INDEX", `SEARCH "${SEARCH_QUERY}"`, "OPEN ONE", "STOP"] as const

/** What the ritual found: every hit, and the ONE note it opened. */
export interface SearchResult {
  query: string
  /** Matching card ids: path matches first, then the rest, each in catalog order. */
  hits: readonly string[]
  /** The one note opened (the first hit), or null when nothing matched. */
  opened: CatalogCard | null
}

/**
 * READ INDEX → SEARCH → OPEN ONE → STOP: match the query against every index
 * line (case-insensitive), rank notes whose path names it first, open exactly
 * one, and read nothing else.
 */
export function searchCatalog(cards: readonly CatalogCard[], query: string): SearchResult {
  const q = query.trim().toLowerCase()
  if (q === "") return { query, hits: [], opened: null }
  const matches = cards.filter((card) => indexLine(card).toLowerCase().includes(q))
  const inPath = matches.filter((card) => cardPath(card).toLowerCase().includes(q))
  const rest = matches.filter((card) => !inPath.includes(card))
  const ranked = [...inPath, ...rest]
  return { query, hits: ranked.map((card) => card.id), opened: ranked[0] ?? null }
}

// ---- widget state ----------------------------------------------------------

/** HUMAN reads the full note; AGENT reads the one-line index. */
export type ReaderView = "human" | "agent"

/** The last transition, for the live line. */
export type ArchiveEvent = "init" | "drawer" | "card" | "view" | "search"

/** A printed call slip. */
export interface CallSlip {
  query: string
  hits: readonly string[]
  /** Id of the one note opened, or null. */
  opened: string | null
}

/** Everything the widget shows. */
export interface ArchiveState {
  /** The open drawer (exactly one is open). */
  drawer: DrawerId
  /** The open note, always a card of the open drawer; null = none picked yet. */
  card: string | null
  view: ReaderView
  slip: CallSlip | null
  /** Bumps each time a visitor action deals a drawer's cards (0 = first paint: no motion). */
  deal: number
  /** Bumps each time a visitor action opens a different note (0 = first paint: no motion). */
  pull: number
  event: ArchiveEvent
}

/** Visitor actions. */
export type ArchiveAction =
  | { type: "openDrawer"; drawer: DrawerId }
  /** Open a card; a card in another drawer (a followed link) opens that drawer too. */
  | { type: "openCard"; drawer: DrawerId; card: string }
  | { type: "setView"; view: ReaderView }
  /** The search slot: the result comes from searchCatalog, computed in the handler. */
  | { type: "printSlip"; query: string; hits: readonly string[]; opened: { drawer: DrawerId; card: string } | null }

/** First paint: the PROJECTS drawer open on the one proven example, full note, no slip. */
export const INITIAL_ARCHIVE_STATE: ArchiveState = {
  drawer: "projects",
  card: "long-range-mesh-firmware",
  view: "human",
  slip: null,
  deal: 0,
  pull: 0,
  event: "init",
}

function move(state: ArchiveState, drawer: DrawerId, card: string | null, event: ArchiveEvent): ArchiveState {
  return {
    ...state,
    drawer,
    card,
    deal: drawer !== state.drawer ? state.deal + 1 : state.deal,
    pull: card !== null && card !== state.card ? state.pull + 1 : state.pull,
    event,
  }
}

/** The widget reducer. Repeating the current choice returns the same state. */
export function archiveReducer(state: ArchiveState, action: ArchiveAction): ArchiveState {
  switch (action.type) {
    case "openDrawer":
      // Pulling a different drawer deals its cards; no note is open until one is picked.
      if (action.drawer === state.drawer) return state
      return move(state, action.drawer, null, "drawer")
    case "openCard":
      if (action.drawer === state.drawer && action.card === state.card) return state
      return move(state, action.drawer, action.card, "card")
    case "setView":
      if (action.view === state.view) return state
      return { ...state, view: action.view, event: "view" }
    case "printSlip": {
      const slip: CallSlip = { query: action.query, hits: action.hits, opened: action.opened?.card ?? null }
      const next = action.opened ? move(state, action.opened.drawer, action.opened.card, "search") : { ...state, event: "search" as const }
      return { ...next, slip }
    }
  }
}

// ---- drawer keys and reveal (pure decisions; the DOM calls stay in the island)

/** Columns of the drawer grid (grid-cols-2 at every width). */
export const DRAWER_COLUMNS = 2

/**
 * Roving focus over the drawer tabs, laid out as a grid: Left/Right step one
 * drawer, Up/Down one row, Home/End jump to the ends; every move wraps.
 * Returns the target index, or null for any other key (the browser keeps it).
 */
export function drawerKeyTarget(key: string, index: number, count: number, columns = DRAWER_COLUMNS): number | null {
  if (count <= 0) return null
  const wrap = (i: number) => ((i % count) + count) % count
  switch (key) {
    case "ArrowRight":
      return wrap(index + 1)
    case "ArrowLeft":
      return wrap(index - 1)
    case "ArrowDown":
      return wrap(index + columns)
    case "ArrowUp":
      return wrap(index - columns)
    case "Home":
      return 0
    case "End":
      return count - 1
    default:
      return null
  }
}

/** Where the answer to a tap sits on screen, in viewport px (from getBoundingClientRect). */
export interface RevealBox {
  /** Top edge of the box holding the answer (the tray, the note). */
  top: number
  /** Bottom edge of its head: the part that must be seen (the first card, the note title). */
  headBottom: number
  /** Height covered by the sticky nav (the box's scroll-margin-top). */
  navOffset: number
  viewportHeight: number
}

/**
 * True when the head of the answer is off-screen (under the nav or below the
 * fold), so the tap scrolls the box to the top. A fully visible head never
 * moves the page. 1 px of slack absorbs sub-pixel rounding after a scroll.
 */
export function needsReveal({ top, headBottom, navOffset, viewportHeight }: RevealBox): boolean {
  return top < navOffset - 1 || headBottom > viewportHeight + 1
}

// ---- live line -------------------------------------------------------------

function drawerLabel(drawers: readonly Drawer[], id: DrawerId): string {
  return drawers.find((d) => d.id === id)?.label ?? id.toUpperCase()
}

/** The polite live line for the current state (one sentence per transition). */
export function narrate(state: ArchiveState, cards: readonly CatalogCard[], drawers: readonly Drawer[]): string {
  const label = drawerLabel(drawers, state.drawer)
  const card = state.card === null ? undefined : cards.find((c) => c.id === state.card)
  switch (state.event) {
    case "view":
      return state.view === "agent" ? "Agent view: one index line per note." : "Human view: the full note."
    case "search": {
      const opened = state.slip?.opened == null ? undefined : cards.find((c) => c.id === state.slip?.opened)
      return opened
        ? `Call slip printed: read index, search "${state.slip?.query}", open one, stop. Opened ${opened.title}.`
        : `Call slip printed. Nothing matched "${state.slip?.query}".`
    }
    case "drawer":
      return `${label} drawer open, cards dealt. Pick a card to read its note.`
    case "card":
    case "init":
      return card ? `${label} drawer. Note open: ${card.title}, ${gradeWords(card)}.` : `${label} drawer open.`
  }
}
