import { LayerSection } from "@/components/common/layer-section"
import { getLayer, type LayerSpec } from "@/lib/layers"
import { ArchiveDrawers } from "./archive-drawers"
import { CARDS, DRAWERS, GRADES } from "./catalog"
import { GradeSquare } from "./grade-mark"
import { GRADE_NOTES } from "./model"

// Layer 0 · Knowledge: "Archive Drawers" (plan §5 L0), a card-catalog cabinet.
// Server Component: the legend, the specs card and the captions render here;
// only the cabinet, its tray and the note are a client island.

/** Layer 0 · Knowledge. */
export function Layer0() {
  const { specs } = getLayer(0)
  return (
    <LayerSection n={0}>
      <ArchiveDrawers
        drawers={DRAWERS}
        cards={CARDS}
        caption="Hubs keep the whole cabinet. Light devices borrow cards from a nearby one."
        aside={
          <>
            <GradeLegend />
            <SpecsCard specs={specs} />
          </>
        }
      />
    </LayerSection>
  )
}

/** The three grades, in grayscale CSS squares (never status dots). */
function GradeLegend() {
  return (
    <div className="border border-border p-4 font-mono">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Grades</p>
      <ul className="mt-3 flex flex-col gap-3">
        {GRADES.map((grade) => (
          <li key={grade} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
            <GradeSquare grade={grade} className="mt-0.5 text-foreground" />
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-widest text-foreground">{grade}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{GRADE_NOTES[grade]}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">Concepts carry no grade.</p>
    </div>
  )
}

/** The four layer specs, printed as one more ruled index card. */
function SpecsCard({ specs }: { specs: readonly LayerSpec[] }) {
  return (
    <div className="border border-border bg-card font-mono shadow-panel">
      <p className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Specifications</p>
      <div aria-hidden="true" className="h-px bg-foreground/50" />
      <dl className="divide-y divide-border">
        {specs.map((spec) => (
          <div key={spec.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5">
            <dt className="text-xs text-muted-foreground">{spec.label}</dt>
            <dd className="text-xs font-bold text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
