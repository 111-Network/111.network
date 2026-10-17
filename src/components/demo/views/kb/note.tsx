// One note, read by a person (real views/kb/index.tsx Document: the record table, then the body).
// The body is structured DOM in the fixed section order of a knowledge note: What it is · Use when ·
// Do NOT use when · (Details) · Evidence, then the linked notes and the services that point here.
// Evidence is derived from the grade (L0 rule): a check appears only where the grade earned it.
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { KB_COPY } from "../../copy/kb"
import { DemoLink } from "../../engine/react"
import { PATHS } from "../../engine/router"
import type { UiMode } from "../../engine/types"
import type { DemoService } from "../../engine/world"
import { RouteLink } from "../../shell/links"
import { FOCUS_RING } from "../../ui/classes"
import { SpecTable, type SpecRow } from "../../ui/spec-table"
import { evidenceFor, linkedNotes, noteGradeWords, noteRoute, usedBy, type Grade, type KbDrawer, type KbNote } from "./model"

const c = KB_COPY.note
/** A 44 px target below a 1024 px shell, compact above it. */
const TARGET = "min-h-11 @min-[1024px]:min-h-0"

/** The record table (real frontmatter rows: status, category and tags first; the rest advanced). */
export function NoteSpec({ note, drawer, mode }: { note: KbNote; drawer: KbDrawer; mode: UiMode }) {
  const rows: SpecRow[] = [
    { label: KB_COPY.spec.grade, value: noteGradeWords(note) },
    {
      label: KB_COPY.spec.drawer,
      value: (
        <RouteLink to={PATHS.kbDrawer(drawer.slug)} className={cn("inline-flex items-center", TARGET)}>
          {drawer.title}
        </RouteLink>
      ),
    },
    { label: KB_COPY.spec.tags, value: note.tags.join(", ") },
    { label: KB_COPY.spec.path, value: <span className="break-all">{note.path}</span>, minMode: "advanced" },
  ]
  return <SpecTable rows={rows} mode={mode} />
}

/** One label/value row of the note (stacked below a 640 px shell). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 @min-[640px]:grid-cols-[9rem_minmax(0,1fr)] @min-[640px]:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs leading-relaxed text-foreground">{children}</dd>
    </div>
  )
}

/** One line as a sentence; several as a dashed list, or numbered steps for a recipe. */
function Lines({ items, ordered = false }: { items: readonly string[]; ordered?: boolean }) {
  if (items.length === 1 && !ordered) return <p>{items[0]}</p>
  const List = ordered ? "ol" : "ul"
  return (
    <List className="flex flex-col gap-1">
      {items.map((line, i) => (
        <li key={line} className="flex gap-2">
          <span aria-hidden="true" className="shrink-0 text-muted-foreground">
            {ordered ? `${i + 1}.` : "–"}
          </span>
          <span className="min-w-0">{line}</span>
        </li>
      ))}
    </List>
  )
}

/** Evidence as CSS squares + words, checked only where the grade earned it (L0). Concepts: none. */
function EvidenceChecks({ grade }: { grade: Grade | null }) {
  const items = evidenceFor(grade)
  if (items.length === 0) return <p className="text-muted-foreground">{KB_COPY.grades.conceptNote}</p>
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.kind} className={cn("flex items-center gap-2", item.earned ? "text-foreground" : "text-muted-foreground")}>
          <span aria-hidden="true" className={cn("h-2 w-2 shrink-0", item.earned ? "bg-foreground" : "border border-muted-foreground")} />
          <span>{item.label}</span>
          {item.earned ? <span className="sr-only">{c.evidenceDone}</span> : <span>{c.evidenceNotYet}</span>}
        </li>
      ))}
    </ul>
  )
}

/** The note's body. */
export function NoteBody({ note, services }: { note: KbNote; services: readonly DemoService[] }) {
  const linked = linkedNotes(note)
  const users = usedBy(services, note)
  return (
    <dl className="divide-y divide-border border border-border font-mono">
      <Row label={c.what}>
        <p>{note.what}</p>
      </Row>
      <Row label={c.useWhen}>
        <Lines items={note.useWhen} />
      </Row>
      <Row label={c.doNotUseWhen}>
        <Lines items={note.doNotUseWhen} />
      </Row>
      {note.details.length > 0 ? (
        <Row label={c.details}>
          <Lines items={note.details} ordered={note.drawer === "recipes"} />
        </Row>
      ) : null}
      <Row label={c.evidence}>
        <EvidenceChecks grade={note.grade} />
      </Row>
      {linked.length > 0 ? (
        <Row label={c.links}>
          <ul className="flex flex-wrap gap-2">
            {linked.map((target) => (
              <li key={target.id}>
                <DemoLink
                  to={noteRoute(target)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors duration-200 hover:border-foreground hover:text-foreground motion-reduce:transition-none @min-[1024px]:min-h-8",
                    FOCUS_RING,
                  )}
                >
                  <span>{target.title}</span>
                  <span aria-hidden="true">→</span>
                </DemoLink>
              </li>
            ))}
          </ul>
        </Row>
      ) : null}
      {users.length > 0 ? (
        <Row label={c.usedBy}>
          <p className="text-muted-foreground">{c.usedByNote}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4">
            {users.map((s) => (
              <li key={s.id}>
                <RouteLink to={PATHS.service(s.id)} className={cn("inline-flex items-center", TARGET)}>
                  {s.name}
                </RouteLink>
              </li>
            ))}
          </ul>
        </Row>
      ) : null}
    </dl>
  )
}
