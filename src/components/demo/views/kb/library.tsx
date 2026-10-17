// The library parts of the Knowledge base view: the six drawer fronts (as on the home L0 section),
// the human index by drawer, a drawer's index cards, the agent's one-line index, the call slip and
// the grade legend. Real source: views/kb/index.tsx renders the index file as a document; here the
// same index is structured data drawn as DOM, so nothing is parsed. Every entry is a real in-demo
// link (DemoLink). Nothing here moves by itself: hover and focus colour only.
import { cn } from "@/lib/utils"
import { KB_COPY } from "../../copy/kb"
import { DemoLink } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { RouteLink } from "../../shell/links"
import { FOCUS_RING_INSET, FOCUS_RING_OFFSET, LABEL_CLASS } from "../../ui/classes"
import { Heading, type HeadingLevel } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { GradeMark } from "./grade-mark"
import {
  GRADE_NOTES,
  GRADES,
  groupByDrawer,
  indexLine,
  KB_DRAWERS,
  noteRoute,
  type FindResult,
  type KbDrawerSlug,
  type KbNote,
} from "./model"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"
/** A 44 px target below a 1024 px shell, compact above it. */
const TARGET = "min-h-11 @min-[1024px]:min-h-0"

/** A heading level a Panel can expose (never 1). */
export type SubLevel = Exclude<HeadingLevel, 1>

/** The level of a section heading inside a view (h2 on /demo, h4 in the L4 window). */
export const subLevel = (h: HeadingLevel): SubLevel => (h === 1 ? 2 : h)

// ------------------------------------------------------------------------------- drawer fronts

export interface DrawerFrontsProps {
  /** The open drawer (inverted, aria-current), or null on the index. */
  current: KbDrawerSlug | null
  /** Notes per drawer, or matches per drawer while a find runs. */
  counts: ReadonlyMap<KbDrawerSlug, number>
  finding: boolean
}

/** The six drawer fronts: a label plate, a handle and a count; the open drawer inverts (L0). */
export function DrawerFronts({ current, counts, finding }: DrawerFrontsProps) {
  return (
    <nav aria-label={KB_COPY.drawers.nav}>
      <ul className="grid grid-cols-2 gap-3 @min-[640px]:grid-cols-3 @min-[1280px]:grid-cols-6">
        {KB_DRAWERS.map((d) => {
          const open = d.slug === current
          const n = counts.get(d.slug) ?? 0
          return (
            <li key={d.slug} className="min-w-0">
              <DemoLink
                to={PATHS.kbDrawer(d.slug)}
                aria-current={open ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-24 min-w-0 flex-col items-center justify-center gap-2 border px-2 py-3 font-mono transition-colors duration-200 motion-reduce:transition-none",
                  FOCUS_RING_OFFSET,
                  open ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:border-foreground",
                )}
              >
                <span
                  className={cn(
                    "max-w-full px-2 py-1 text-center text-[10px] uppercase leading-tight tracking-widest",
                    open ? "bg-background text-foreground" : "bg-foreground text-background",
                  )}
                >
                  {d.label}
                </span>
                <span aria-hidden="true" className={cn("h-1 w-6", open ? "bg-background" : "bg-foreground")} />
                <span className="sr-only">{`${KB_COPY.drawers.suffix}, `}</span>
                <span className={cn("text-[10px] tracking-wider", open ? "text-background/80" : "text-muted-foreground")}>
                  {finding ? KB_COPY.drawers.matches(n) : KB_COPY.drawers.count(n)}
                </span>
              </DemoLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ------------------------------------------------------------------------------- human index

/** One note as an index row: title and one-line summary, the grade mark at the end. */
function NoteRowLink({ note }: { note: KbNote }) {
  return (
    <DemoLink
      to={noteRoute(note)}
      className={cn(
        "flex items-start justify-between gap-3 px-3 py-2.5 font-mono transition-colors duration-200 hover:bg-secondary/50 motion-reduce:transition-none",
        TARGET,
        FOCUS_RING_INSET,
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-bold text-foreground">{note.title}</span>
        <span className="text-[11px] leading-relaxed text-muted-foreground">{note.summary}</span>
      </span>
      <GradeMark grade={note.grade} example={note.example} className="shrink-0 pt-0.5 text-foreground" />
    </DemoLink>
  )
}

/** The human index: one section per drawer (title, blurb, its notes), in cabinet order. */
export function IndexByDrawer({ notes, level, idBase }: { notes: readonly KbNote[]; level: HeadingLevel; idBase: string }) {
  return (
    <div className="flex flex-col gap-6">
      {groupByDrawer(notes).map(({ drawer, notes: inDrawer }) => {
        const headingId = `${idBase}-${drawer.slug}`
        return (
          <section key={drawer.slug} aria-labelledby={headingId} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <Heading level={level} id={headingId} className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                <RouteLink to={PATHS.kbDrawer(drawer.slug)} className={cn("inline-flex items-center", TARGET)}>
                  {drawer.title}
                </RouteLink>
              </Heading>
              <span className={LABEL_CLASS}>{KB_COPY.drawers.count(inDrawer.length)}</span>
            </div>
            <p className={TEXT}>{drawer.blurb}</p>
            <ul className="divide-y divide-border border border-border">
              {inDrawer.map((n) => (
                <li key={n.id}>
                  <NoteRowLink note={n} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** A drawer's notes as ruled index cards (L0 cards): title, grade mark, summary, path. */
export function DrawerCards({ notes }: { notes: readonly KbNote[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 @min-[640px]:grid-cols-2 @min-[1280px]:grid-cols-3">
      {notes.map((n) => (
        <li key={n.id} className="min-w-0">
          <DemoLink
            to={noteRoute(n)}
            className={cn(
              "flex h-full flex-col border border-border bg-card font-mono text-foreground transition-colors duration-200 hover:border-foreground motion-reduce:transition-none",
              FOCUS_RING_OFFSET,
            )}
          >
            <span className="flex items-start justify-between gap-3 px-3 pt-3 pb-2">
              <span className="min-w-0 text-sm font-bold leading-snug">{n.title}</span>
              <GradeMark grade={n.grade} example={n.example} className="shrink-0 pt-0.5" />
            </span>
            <span aria-hidden="true" className="block h-px bg-foreground/50" />
            <span className="block divide-y divide-border text-[11px] leading-6 text-muted-foreground">
              <span className="block px-3 py-0.5">{n.summary}</span>
              <span aria-hidden="true" className="block px-3 py-0.5 wrap-anywhere">
                {n.path}
              </span>
            </span>
          </DemoLink>
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------------------- agent index

export interface AgentIndexProps {
  notes: readonly KbNote[]
  /** The note being read (marked, aria-current), if any. */
  current?: string
  heading: SubLevel
}

/**
 * The agent's view: the index file as it reads it, one line per note in the fixed grammar
 * `- [title](path): summary | grade | tags`, grouped under one line per drawer. Each line opens
 * its note.
 */
export function AgentIndex({ notes, current, heading }: AgentIndexProps) {
  const c = KB_COPY.index
  return (
    <Panel as="section" title={c.title} suffix={c.suffix} heading={heading} tint flush aria-label={c.region}>
      <div className="px-4 py-4 font-mono text-[11px] leading-relaxed">
        <p className="text-foreground">{c.heading}</p>
        <p className="text-muted-foreground">{c.about}</p>
        <p className="text-muted-foreground">{c.grammar}</p>
        {groupByDrawer(notes).map(({ drawer, notes: inDrawer }) => (
          <div key={drawer.slug} className="mt-3">
            <p className="text-foreground">{c.drawer(drawer.title)}</p>
            <ul className="mt-1 flex flex-col">
              {inDrawer.map((n) => {
                const on = n.id === current
                return (
                  <li key={n.id}>
                    <DemoLink
                      to={noteRoute(n)}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex items-start gap-2 py-1 transition-colors duration-200 hover:bg-foreground hover:text-background motion-reduce:transition-none",
                        TARGET,
                        FOCUS_RING_INSET,
                        on ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span aria-hidden="true" className="w-3 shrink-0">
                        {on ? "▶" : ""}
                      </span>
                      <span className="min-w-0 wrap-anywhere">{indexLine(n)}</span>
                    </DemoLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/**
 * The call slip (L0 search slot), printed whole for the find text: READ INDEX -> SEARCH -> OPEN ONE
 * -> STOP, and the one note it opens. It changes only as the visitor types.
 */
export function CallSlip({ find, query }: { find: FindResult; query: string }) {
  const c = KB_COPY.slip
  const opened = find.opened
  return (
    <div className="border border-dashed border-foreground/70 px-3 py-3 font-mono">
      <p className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{c.title}</span>
        <span>{c.reader}</span>
      </p>
      <ol aria-label={c.stepsLabel} className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold tracking-wider text-foreground">
        {c.steps(query.trim()).map((step, i) => (
          <li key={step} className="inline-flex items-center gap-2">
            {i > 0 ? (
              <span aria-hidden="true" className="font-normal text-muted-foreground">
                →
              </span>
            ) : null}
            <span className="wrap-anywhere">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-muted-foreground wrap-anywhere">
        {opened ? (
          <>
            {c.opens}{" "}
            <RouteLink to={noteRoute(opened)} className={cn("inline-flex items-center", TARGET)}>
              {opened.path}
            </RouteLink>{" "}
            {c.only}
          </>
        ) : (
          c.nothing
        )}
      </p>
    </div>
  )
}

// ------------------------------------------------------------------------------- grade legend

/** The three grades as on L0 (dashed = candidate, half = testing, solid = proven) and the ungraded concept. No tallies. */
export function GradeLegend({ heading }: { heading: SubLevel }) {
  return (
    <Panel title={KB_COPY.grades.title} suffix={KB_COPY.grades.suffix} heading={heading}>
      <ul className="flex flex-col gap-2 font-mono text-xs">
        {GRADES.map((g) => (
          <li key={g} className="flex flex-col gap-1 @min-[640px]:flex-row @min-[640px]:items-start @min-[640px]:gap-3">
            <GradeMark grade={g} className="shrink-0 justify-start text-foreground @min-[640px]:w-28" />
            <span className="leading-relaxed text-muted-foreground">{GRADE_NOTES[g]}</span>
          </li>
        ))}
        <li className="flex flex-col gap-1 @min-[640px]:flex-row @min-[640px]:items-start @min-[640px]:gap-3">
          <GradeMark grade={null} className="shrink-0 @min-[640px]:w-28" />
          <span className="leading-relaxed text-muted-foreground">{KB_COPY.grades.conceptNote}</span>
        </li>
      </ul>
    </Panel>
  )
}
