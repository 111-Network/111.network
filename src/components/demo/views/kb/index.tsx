// Knowledge base (#/kb, #/kb/<drawer>, #/kb/<drawer>/<note>; Layer 0; plan §6.4). Real source:
// os/4-interface/ui/src/views/kb/{index,render}.tsx: a section header, the "All entries / path"
// breadcrumb, the record table and the note body, with honest 404 states. The demo reads the same
// library as the home L0 section (six drawers, the same cards and grades) from views/kb/model.ts
// instead of the node's API, and adds L0's two reader views (HUMAN reads the full note, AGENT the
// one-line index) and a find field with the agent's call slip. The reader and the find text live
// in the kb slice, so they survive moving between pages. Nothing here is scheduled: the library is
// static sample data, and the page only changes when the visitor clicks or types.
import { useEffect, useId, useMemo, useRef, type ChangeEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { ROUTE_TITLES } from "../../copy/core"
import { KB_COPY } from "../../copy/kb"
import { useDemo, useDispatch } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { selectServices, serviceById } from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import { KB_QUERY_MAX, type KbReader } from "../../engine/slices/kb"
import type { ServiceState } from "../../engine/types"
import { useAnnounce, useHeadingLevel } from "../../shell/context"
import { RouteButtonLink, RouteLink } from "../../shell/links"
import { selectMode } from "../../shell/select"
import type { ViewProps } from "../../shell/view-types"
import { Button } from "../../ui/button"
import { FIELD_CLASS, LABEL_CLASS } from "../../ui/classes"
import { Empty } from "../../ui/empty"
import { Heading, type HeadingLevel } from "../../ui/heading"
import { Segmented, type SegmentedOption } from "../../ui/segmented"
import { StatusDot } from "../../ui/status-dot"
import { GradeMark } from "./grade-mark"
import { AgentIndex, CallSlip, DrawerCards, DrawerFronts, GradeLegend, IndexByDrawer, subLevel } from "./library"
import {
  drawerBySlug,
  findNotes,
  findSentence,
  frontCounts,
  kbPageOf,
  notesIn,
  pageDrawer,
  pageKey,
  pageNotes,
  type KbPage,
} from "./model"
import { NoteBody, NoteSpec } from "./note"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"
const LEAD = "max-w-prose font-mono text-sm leading-relaxed text-foreground"
/** A 44 px target below a 1024 px shell, compact above it. */
const TARGET = "min-h-11 @min-[1024px]:min-h-0"

const selectReader = (s: DemoState): KbReader => s.kb.reader
const selectQuery = (s: DemoState): string => s.kb.query
const selectKbServiceState = (s: DemoState): ServiceState => serviceById(s, "kb")?.state ?? "live"

const READER_OPTIONS: readonly SegmentedOption<KbReader>[] = [
  { value: "human", label: KB_COPY.reader.human },
  { value: "agent", label: KB_COPY.reader.agent },
]

type LibraryPage = Extract<KbPage, { kind: "index" | "drawer" | "note" }>
type MissingPage = Exclude<KbPage, LibraryPage>

// ------------------------------------------------------------------------------------ header

interface Crumb {
  label: string
  to?: string
}

/** "All drawers / PROJECTS / note" (real "All entries / path"); the last crumb is the current page. */
function Crumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label={KB_COPY.crumbs.label}>
      <ol className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted-foreground">
        {items.map((item, i) => (
          <li key={item.label} className="inline-flex min-w-0 items-center gap-2">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.to ? (
              <RouteLink to={item.to} className={cn("inline-flex items-center", TARGET)}>
                {item.label}
              </RouteLink>
            ) : (
              <span aria-current="page" className="break-all text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

interface HeaderProps {
  level: HeadingLevel
  titleId: string
  kicker: string
  title: string
  end?: ReactNode
}

/** SectionHeader's look, with a focusable title (focus lands here when the page changes). */
function KbHeader({ level, titleId, kicker, title, end }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span className={LABEL_CLASS}>{kicker}</span>
        <Heading level={level} id={titleId} tabIndex={-1} className="mt-1 font-pixel-line text-2xl font-bold text-foreground @min-[768px]:text-3xl">
          {title}
        </Heading>
      </div>
      {end ? <div className="shrink-0">{end}</div> : null}
    </header>
  )
}

/** Shown only while the Knowledge base service is not LIVE: the notes are the copy already held. */
function Degraded({ state }: { state: ServiceState }) {
  if (state === "live") return null
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border px-3 py-2 font-mono text-xs text-muted-foreground">
      <StatusDot state={state} />
      <span>{KB_COPY.degraded.note}</span>
      <RouteLink to={PATHS.service("kb")} className={cn("inline-flex items-center", TARGET)}>
        {KB_COPY.degraded.link}
      </RouteLink>
    </p>
  )
}

// ----------------------------------------------------------------------------------- toolbar

interface ToolbarProps {
  reader: KbReader
  onReader: (next: KbReader) => void
  /** The find field, on the index and drawer pages only. */
  find?: { query: string; onQuery: (next: string) => void }
}

function Toolbar({ reader, onReader, find }: ToolbarProps) {
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const clear = () => {
    find?.onQuery("")
    inputRef.current?.focus()
  }
  return (
    <div className="flex flex-col gap-4 @min-[768px]:flex-row @min-[768px]:items-start">
      <div className="flex shrink-0 flex-col gap-1">
        <span aria-hidden="true" className={LABEL_CLASS}>
          {KB_COPY.reader.group}
        </span>
        <Segmented label={KB_COPY.reader.group} value={reader} onChange={onReader} options={READER_OPTIONS} size="sm" />
      </div>
      {find ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={inputId} className={LABEL_CLASS}>
            {KB_COPY.find.label}
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              value={find.query}
              onChange={(e: ChangeEvent<HTMLInputElement>) => find.onQuery(e.target.value)}
              maxLength={KB_QUERY_MAX}
              placeholder={KB_COPY.find.placeholder}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={hintId}
              className={cn(FIELD_CLASS, "min-h-11 min-w-0 flex-1")}
            />
            <Button size="sm" onClick={clear} disabled={find.query === ""} className="shrink-0">
              {KB_COPY.find.clear}
            </Button>
          </div>
          <p id={hintId} className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            {KB_COPY.find.hint}
          </p>
        </div>
      ) : null}
    </div>
  )
}

// -------------------------------------------------------------------------------------- pages

/** Moves focus to the page title after an in-view move (not on the first paint). */
function useFocusTitleOnChange(key: string, titleId: string) {
  const last = useRef<string | null>(null)
  useEffect(() => {
    const prev = last.current
    last.current = key
    if (prev === null || prev === key) return
    document.getElementById(titleId)?.focus({ preventScroll: true })
  }, [key, titleId])
}

function Library({ page }: { page: LibraryPage }) {
  const level = useHeadingLevel()
  const section = useHeadingLevel(1)
  const reader = useDemo(selectReader)
  const query = useDemo(selectQuery)
  const mode = useDemo(selectMode)
  const services = useDemo(selectServices)
  const kbState = useDemo(selectKbServiceState)
  const dispatch = useDispatch()
  const announce = useAnnounce()
  const titleId = useId()
  const sectionsId = useId()
  useFocusTitleOnChange(pageKey(page), titleId)

  const find = useMemo(() => findNotes(query), [query])
  const finding = find.terms.length > 0
  const listed = pageNotes(page, find)

  const onReader = (next: KbReader) => {
    dispatch({ type: "kb/setReader", reader: next })
    announce(KB_COPY.reader.announce[next])
  }
  const onQuery = (next: string) => {
    dispatch({ type: "kb/setQuery", query: next })
    announce(findSentence(page, findNotes(next), next))
  }

  const human = reader === "human"
  const crumbs: Crumb[] =
    page.kind === "index"
      ? []
      : page.kind === "drawer"
        ? [{ label: KB_COPY.crumbs.all, to: PATHS.kb }, { label: page.drawer.label }]
        : [
            { label: KB_COPY.crumbs.all, to: PATHS.kb },
            { label: page.drawer.label, to: PATHS.kbDrawer(page.drawer.slug) },
            { label: page.note.id },
          ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <KbHeader
          level={level}
          titleId={titleId}
          kicker={page.kind === "index" ? KB_COPY.kicker : page.kind === "drawer" ? KB_COPY.drawerKicker : KB_COPY.noteKicker}
          title={page.kind === "index" ? ROUTE_TITLES.kb : page.kind === "drawer" ? page.drawer.title : page.note.title}
          end={page.kind === "note" ? <GradeMark grade={page.note.grade} example={page.note.example} className="text-foreground" /> : undefined}
        />
        {crumbs.length > 0 ? <Crumbs items={crumbs} /> : null}
        <p className={LEAD}>{page.kind === "index" ? KB_COPY.lead : page.kind === "drawer" ? page.drawer.blurb : page.note.summary}</p>
        <Degraded state={kbState} />
      </div>

      <Toolbar reader={reader} onReader={onReader} find={page.kind === "note" ? undefined : { query, onQuery }} />

      {page.kind === "note" ? (
        human ? (
          <div className="flex flex-col gap-4">
            <NoteSpec note={page.note} drawer={page.drawer} mode={mode} />
            <NoteBody note={page.note} services={services} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className={TEXT}>{KB_COPY.reader.note}</p>
            <AgentIndex notes={notesIn(page.drawer.slug)} current={page.note.id} heading={subLevel(section)} />
          </div>
        )
      ) : (
        <>
          <DrawerFronts current={pageDrawer(page)} counts={frontCounts(find)} finding={finding} />
          {!human && finding ? <CallSlip find={find} query={query} /> : null}
          {finding && listed.length > 0 ? <p className={TEXT}>{findSentence(page, find, query)}</p> : null}
          {listed.length === 0 ? (
            <Empty title={findSentence(page, find, query)}>
              {page.kind === "drawer" && find.hits.length > 0 ? KB_COPY.find.elsewhere : KB_COPY.find.noneHint}
            </Empty>
          ) : human ? (
            page.kind === "index" ? (
              <IndexByDrawer notes={listed} level={section} idBase={sectionsId} />
            ) : (
              <DrawerCards notes={listed} />
            )
          ) : (
            <>
              <p className={TEXT}>{KB_COPY.reader.note}</p>
              <AgentIndex notes={listed} heading={subLevel(section)} />
            </>
          )}
          {human ? <GradeLegend heading={subLevel(section)} /> : null}
        </>
      )}
    </div>
  )
}

/** The honest 404s (real "No such entry"), each with the way back. */
function Missing({ page }: { page: MissingPage }) {
  const c = KB_COPY.notFound
  if (page.kind === "no-drawer") {
    return (
      <Empty
        kicker={c.kicker}
        title={c.drawerTitle}
        action={
          <RouteButtonLink to={PATHS.kb} size="sm">
            {c.browse}
          </RouteButtonLink>
        }
      >
        {c.drawerBody}
      </Empty>
    )
  }
  if (page.kind === "no-note") {
    return (
      <Empty
        kicker={c.kicker}
        title={c.noteTitle}
        action={
          <RouteButtonLink to={PATHS.kbDrawer(page.drawer.slug)} size="sm">
            {c.openDrawer(page.drawer.title)}
          </RouteButtonLink>
        }
      >
        {c.noteBody(page.drawer.title, page.slug)}
      </Empty>
    )
  }
  const home = drawerBySlug(page.note.drawer)
  return (
    <Empty
      kicker={c.kicker}
      title={c.elsewhereTitle}
      action={
        <RouteButtonLink to={PATHS.kbNote(page.note.drawer, page.note.id)} size="sm">
          {c.openNote}
        </RouteButtonLink>
      }
    >
      {c.elsewhereBody(page.note.title, home?.title ?? page.note.drawer)}
    </Empty>
  )
}

export default function KbView({ route }: ViewProps) {
  const page = kbPageOf(route)
  if (page.kind === "index" || page.kind === "drawer" || page.kind === "note") return <Library page={page} />
  return <Missing page={page} />
}
