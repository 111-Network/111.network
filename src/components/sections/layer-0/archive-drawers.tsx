"use client"

import { useReducer, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { ChipGroup, type ChipOption } from "@/components/common/chip-group"
import { LiveLine } from "@/components/common/live-line"
import { SimulationChip } from "@/components/common/simulation-chip"
import { scrollBehavior } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { CatalogCard, Drawer, DrawerId, Grade } from "./catalog"
import { GradeMark } from "./grade-mark"
import {
  CALL_SLIP_STEPS,
  INITIAL_ARCHIVE_STATE,
  SEARCH_QUERY,
  archiveReducer,
  cardPath,
  drawerKeyTarget,
  evidenceFor,
  indexLine,
  narrate,
  needsReveal,
  searchCatalog,
  type ArchiveAction,
  type ReaderView,
} from "./model"

// L0 "Archive Drawers" (plan §5 L0): six drawer fronts deal ruled index cards,
// a card opens its note record, HUMAN │ AGENT swaps the note for the agent's
// index line, and the search slot prints the call slip whole. No JS loop: the
// only motion is a CSS deal / fade that answers a click, never on first paint
// (deal = pull = 0), and none at all under reduced motion.
//
// Semantics: exactly one drawer is open and all six share one tray, so the
// fronts are a tablist (roving tabindex, arrow keys over the 2-column grid)
// and the tray is its tabpanel. A card opens a note rather than toggling, so
// the open card is aria-current, not aria-pressed.

const TRAY_ID = "layer-0-tray"
const NOTE_ID = "layer-0-note"
const SLIP_ID = "layer-0-slip"

/** Id of a drawer's tab (the tray is labelled by the open one). */
const drawerTabId = (id: DrawerId) => `layer-0-drawer-${id}`

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"

/** Below lg the tray stacks under the cabinet and the note under the cards. */
const STACKED_QUERY = "(max-width: 1023.98px)"

/**
 * Handlers only. When the head of what a tap produced is off-screen (under the
 * nav or below the fold), scroll its box to the top, landing below the nav via
 * the box's scroll-mt-nav; a fully visible head never moves the page.
 */
function reveal(box: HTMLElement | null, head: Element | null): void {
  if (box === null) return
  const needed = needsReveal({
    top: box.getBoundingClientRect().top,
    headBottom: (head ?? box).getBoundingClientRect().bottom,
    navOffset: Number.parseFloat(getComputedStyle(box).scrollMarginTop) || 0,
    viewportHeight: window.innerHeight,
  })
  if (needed) box.scrollIntoView({ behavior: scrollBehavior(), block: "start" })
}

/** Handlers only: the stacked (below lg) layout is showing. */
function stacked(): boolean {
  return window.matchMedia(STACKED_QUERY).matches
}

const READERS: readonly ChipOption<ReaderView>[] = [
  { value: "human", label: "HUMAN" },
  { value: "agent", label: "AGENT" },
]

/** Props of ArchiveDrawers. The catalog comes from the server as props, so it is not bundled. */
export interface ArchiveDrawersProps {
  drawers: readonly Drawer[]
  cards: readonly CatalogCard[]
  /** Server-rendered line under the drawer fronts. */
  caption?: ReactNode
  /** Server-rendered static column (legend, specs): under the cabinet on lg, after the note below lg. */
  aside?: ReactNode
}

/** The card-catalog cabinet, its tray of index cards and the open note. */
export function ArchiveDrawers({ drawers, cards, caption, aside }: ArchiveDrawersProps) {
  const [state, dispatch] = useReducer(archiveReducer, INITIAL_ARCHIVE_STATE)
  const trayRef = useRef<HTMLDivElement>(null)
  const noteRef = useRef<HTMLElement>(null)
  const noteTitleRef = useRef<HTMLHeadingElement>(null)

  const drawer = drawers.find((d) => d.id === state.drawer) ?? drawers[0]
  const dealt = cards.filter((c) => c.drawer === state.drawer)
  const card = state.card === null ? null : (cards.find((c) => c.id === state.card) ?? null)
  const linked = card === null ? [] : card.links.flatMap((id) => cards.filter((c) => c.id === id))
  const slip = state.slip
  const opened = slip?.opened == null ? null : (cards.find((c) => c.id === slip.opened) ?? null)
  const hits = new Set(slip?.hits ?? [])
  const hitDrawers = new Set(cards.filter((c) => hits.has(c.id)).map((c) => c.drawer))
  const live = narrate(state, cards, drawers)
  const dealing = state.deal > 0

  /**
   * A pointer tap below lg (event.detail > 0; a keyboard Enter / Space reports
   * 0) commits first, then brings the answer into view if it is off-screen.
   * Keyboard users keep the page where their focus is.
   */
  function dispatchThenShow(action: ArchiveAction, event: MouseEvent<HTMLElement>, show: () => void) {
    if (event.detail > 0 && stacked()) {
      flushSync(() => dispatch(action))
      show()
    } else {
      dispatch(action)
    }
  }

  function openDrawer(id: DrawerId, event: MouseEvent<HTMLButtonElement>) {
    // Below lg the tray sits under the whole cabinet: show the dealt cards.
    dispatchThenShow({ type: "openDrawer", drawer: id }, event, () => {
      reveal(trayRef.current, trayRef.current?.querySelector("li") ?? null)
    })
  }

  /** Arrow keys / Home / End move the open drawer and its focus (automatic activation). */
  function onDrawerKey(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const target = drawerKeyTarget(event.key, index, drawers.length)
    const next = target === null ? undefined : drawers[target]
    if (next === undefined) return
    event.preventDefault()
    dispatch({ type: "openDrawer", drawer: next.id })
    document.getElementById(drawerTabId(next.id))?.focus()
  }

  function openCard(target: CatalogCard, event: MouseEvent<HTMLButtonElement>) {
    // Below lg the note sits under the cards: show its title (or, in the agent view, its index line).
    dispatchThenShow({ type: "openCard", drawer: target.drawer, card: target.id }, event, () => {
      const note = noteRef.current
      reveal(note, noteTitleRef.current ?? note?.querySelector('[aria-current="true"]') ?? null)
    })
  }

  function followLink(target: CatalogCard) {
    // The pressed link leaves with the old note and a re-dealt tray can move the note,
    // so commit first, then bring the new title into view and give it focus.
    flushSync(() => dispatch({ type: "openCard", drawer: target.drawer, card: target.id }))
    reveal(noteRef.current, noteTitleRef.current)
    noteTitleRef.current?.focus({ preventScroll: true })
  }

  function printSlip() {
    const result = searchCatalog(cards, SEARCH_QUERY)
    dispatch({
      type: "printSlip",
      query: result.query,
      hits: result.hits,
      opened: result.opened ? { drawer: result.opened.drawer, card: result.opened.id } : null,
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-8">
      {/* Cabinet: drawer fronts + search slot */}
      <div className="min-w-0 border border-border bg-card shadow-panel lg:col-span-5 lg:row-start-1 lg:self-start">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Card catalog</span>
          <SimulationChip />
        </div>

        <div role="tablist" aria-label="Drawers" className="grid grid-cols-2 gap-3 p-4">
          {drawers.map((d, index) => {
            const open = d.id === state.drawer
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                id={drawerTabId(d.id)}
                aria-selected={open}
                aria-controls={TRAY_ID}
                tabIndex={open ? 0 : -1}
                onClick={(event) => openDrawer(d.id, event)}
                onKeyDown={(event) => onDrawerKey(index, event)}
                className={cn(
                  "relative flex h-28 min-w-0 flex-col items-center justify-center gap-3 border px-2 font-mono transition-colors duration-200 motion-reduce:transition-none",
                  FOCUS,
                  open
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:border-foreground",
                )}
              >
                <span
                  className={cn(
                    "max-w-full px-2 py-1 text-[10px] uppercase leading-tight tracking-widest",
                    open ? "bg-background text-foreground" : "bg-foreground text-background",
                  )}
                >
                  {d.label}
                </span>
                <span aria-hidden="true" className={cn("h-1 w-6", open ? "bg-background" : "bg-foreground")} />
                <span className="sr-only"> drawer</span>
                {hitDrawers.has(d.id) ? (
                  // Solid outline: the dashed outline stays reserved for the candidate grade.
                  <span className="absolute top-1 right-1 border border-current px-1 text-[10px] uppercase leading-4 tracking-wider">
                    <span className="sr-only">, </span>
                    match
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {caption != null ? (
          <p className="px-4 pb-4 font-mono text-[11px] leading-relaxed text-muted-foreground">{caption}</p>
        ) : null}

        <div className="border-t border-border p-4">
          <button
            type="button"
            onClick={printSlip}
            aria-controls={SLIP_ID}
            // Label in Name: the accessible name starts with the visible words.
            aria-label={`Search slot "${SEARCH_QUERY}": print a call slip`}
            className={cn(
              "group flex min-h-11 w-full items-center gap-3 border border-border bg-background px-3 py-2 text-left font-mono transition-colors duration-200 hover:border-foreground motion-reduce:transition-none",
              FOCUS,
            )}
          >
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Search slot</span>
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{`"${SEARCH_QUERY}"`}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-foreground">
              {"print ->"}
            </span>
          </button>
          <span aria-hidden="true" className="mx-4 block h-0.5 bg-foreground/30" />
          <div id={SLIP_ID}>
            {slip ? (
              <div className="mt-3 border border-dashed border-foreground/70 px-3 py-3 font-mono animate-in fade-in slide-in-from-top-2 duration-200 motion-reduce:animate-none">
                <p className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>Call slip</span>
                  <span>reader: agent</span>
                </p>
                <ol
                  aria-label="Call slip steps"
                  className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold tracking-wider text-foreground"
                >
                  {CALL_SLIP_STEPS.map((step, i) => (
                    <li key={step} className="inline-flex items-center gap-2">
                      {i > 0 ? (
                        <span aria-hidden="true" className="font-normal text-muted-foreground">
                          →
                        </span>
                      ) : null}
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-muted-foreground wrap-anywhere">
                  {opened ? `opened: ${cardPath(opened)} · nothing else read` : "no note matched"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tray of dealt cards + the open note */}
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
        <div className="flex items-start gap-2 font-mono text-[10px] text-muted-foreground">
          <span aria-hidden="true">▶</span>
          <LiveLine>{live}</LiveLine>
        </div>

        <div
          ref={trayRef}
          id={TRAY_ID}
          role="tabpanel"
          aria-labelledby={drawerTabId(drawer.id)}
          className="min-w-0 scroll-mt-nav border border-border bg-background"
        >
          <div className="flex items-center justify-between gap-3 bg-foreground px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-background">
            <span>Drawer · {drawer.label}</span>
            <span className="normal-case tracking-normal text-background/70">{`${drawer.id}/`}</span>
          </div>
          <ul key={state.deal} className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
            {dealt.map((c, i) => {
              const selected = c.id === state.card
              return (
                <li
                  key={c.id}
                  className={cn(
                    dealing &&
                      "animate-in fade-in slide-in-from-top-2 duration-300 fill-mode-both motion-reduce:animate-none",
                  )}
                  style={dealing ? { animationDelay: `${i * 60}ms` } : undefined}
                >
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    aria-controls={NOTE_ID}
                    onClick={(event) => openCard(c, event)}
                    className={cn(
                      "flex h-full w-full flex-col border text-left font-mono transition-colors duration-200 motion-reduce:transition-none",
                      FOCUS,
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:border-foreground",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3 px-3 pt-3 pb-2">
                      <span className="min-w-0 text-sm leading-snug font-bold">{c.title}</span>
                      <GradeMark grade={c.grade} example={c.example} className="shrink-0 pt-0.5" />
                    </span>
                    <span aria-hidden="true" className={cn("block h-px", selected ? "bg-background" : "bg-foreground/50")} />
                    <span
                      className={cn(
                        "block divide-y text-[11px] leading-6",
                        selected ? "divide-background/25 text-background/80" : "divide-border text-muted-foreground",
                      )}
                    >
                      <span className="block px-3 py-0.5">{c.summary}</span>
                      <span aria-hidden="true" className="block px-3 py-0.5 wrap-anywhere">
                        {cardPath(c)}
                      </span>
                      <span aria-hidden="true" className="hidden h-6 sm:block" />
                    </span>
                    {hits.has(c.id) ? (
                      <span className="mx-3 mt-auto mb-3 self-start border border-current px-1.5 text-[10px] leading-4 tracking-wider">
                        {`match "${slip?.query ?? SEARCH_QUERY}"`}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <article
          ref={noteRef}
          id={NOTE_ID}
          aria-label="Note record"
          className="min-w-0 scroll-mt-nav border border-border bg-card shadow-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-foreground" />
              <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {state.view === "agent" ? `Index · ${drawer.id}/` : card ? `Note · ${cardPath(card)}` : "Note"}
              </span>
            </div>
            <ChipGroup
              aria-label="Reader"
              value={state.view}
              onValueChange={(view) => dispatch({ type: "setView", view })}
              options={READERS}
            />
          </div>

          {state.view === "agent" ? (
            <div className="px-4 py-4 font-mono">
              <ul className="flex flex-col gap-2 text-[11px] leading-relaxed">
                {dealt.map((c) => {
                  const on = c.id === state.card
                  return (
                    <li
                      key={c.id}
                      aria-current={on ? "true" : undefined}
                      className={cn("flex gap-2", on ? "text-foreground" : "text-muted-foreground")}
                    >
                      <span aria-hidden="true" className="w-3 shrink-0">
                        {on ? "▶" : ""}
                      </span>
                      <span className="min-w-0 wrap-anywhere">{indexLine(c)}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                The agent reads one line per note and opens the full note only when it must.
              </p>
            </div>
          ) : card ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                <h3
                  ref={noteTitleRef}
                  tabIndex={-1}
                  className="min-w-0 scroll-mt-nav font-mono text-sm font-bold text-foreground md:text-base"
                >
                  {card.title}
                </h3>
                <GradeMark grade={card.grade} example={card.example} className="text-foreground" />
              </div>
              <dl
                key={state.pull}
                className={cn(
                  "divide-y divide-border font-mono",
                  state.pull > 0 && "animate-in fade-in duration-200 motion-reduce:animate-none",
                )}
              >
                <NoteRow label="What it is">
                  <p>{card.what}</p>
                </NoteRow>
                <NoteRow label="Use when">
                  <Lines items={card.useWhen} />
                </NoteRow>
                <NoteRow label="Do NOT use when">
                  <Lines items={card.doNotUseWhen} />
                </NoteRow>
                <NoteRow label="Evidence">
                  <EvidenceChecks grade={card.grade} />
                </NoteRow>
                {linked.length > 0 ? (
                  <NoteRow label="Linked notes">
                    <ul className="flex flex-wrap gap-2">
                      {linked.map((target) => (
                        <li key={target.id}>
                          <button
                            type="button"
                            onClick={() => followLink(target)}
                            className={cn(
                              "inline-flex min-h-11 items-center gap-2 border border-border px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors duration-200 hover:border-foreground hover:text-foreground motion-reduce:transition-none sm:min-h-8",
                              FOCUS,
                            )}
                          >
                            <span>{target.title}</span>
                            <span aria-hidden="true">→</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </NoteRow>
                ) : null}
              </dl>
            </>
          ) : (
            <p className="px-4 py-10 font-mono text-xs text-muted-foreground">
              Pick a card from the {drawer.label} drawer to read its note.
            </p>
          )}
        </article>
      </div>

      {aside != null ? (
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:self-start">
          {aside}
        </div>
      ) : null}
    </div>
  )
}

/** One label/value row of the note record (the SpecTable genre, stacked below sm). */
function NoteRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs leading-relaxed text-foreground">{children}</dd>
    </div>
  )
}

/** One line as a sentence, several as a dashed list. */
function Lines({ items }: { items: readonly string[] }) {
  if (items.length === 1) return <p>{items[0]}</p>
  return (
    <ul className="flex flex-col gap-1">
      {items.map((line) => (
        <li key={line} className="flex gap-2">
          <span aria-hidden="true" className="text-muted-foreground">
            –
          </span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

/** Evidence as CSS squares + words, checked only where the grade earned it. */
function EvidenceChecks({ grade }: { grade: Grade | null }) {
  const items = evidenceFor(grade)
  if (items.length === 0) {
    return <p className="text-muted-foreground">No grade. A concept is a timeless reference, not a project to adopt.</p>
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li
          key={item.kind}
          className={cn("flex items-center gap-2", item.earned ? "text-foreground" : "text-muted-foreground")}
        >
          <span
            aria-hidden="true"
            className={cn("h-2 w-2 shrink-0", item.earned ? "bg-foreground" : "border border-muted-foreground")}
          />
          <span>{item.label}</span>
          {item.earned ? <span className="sr-only">: done</span> : <span>· not yet</span>}
        </li>
      ))}
    </ul>
  )
}
