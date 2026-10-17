import { LayerSection } from "@/components/common/layer-section"
import { SimulationChip } from "@/components/common/simulation-chip"
import { getLayer } from "@/lib/layers"
import { SeekBoard } from "./seek-board"
import { ThinBridge } from "./thin-bridge"

// Layer 6 · Transport & Bridge (plan §5 L6): blueprint schematic + exploded
// cross-section. Server-rendered shell; the two widgets are client islands.

const LABEL = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

/** Faint blueprint grid behind the seek board (an SVG pattern, no CSS gradient). */
function BlueprintGrid() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-foreground opacity-[0.06]">
      <defs>
        <pattern id="l6-blueprint-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#l6-blueprint-grid)" />
    </svg>
  )
}

/** A component's stamp-box title, its SIMULATION chip and a one-line caption. */
function StampTitle({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="inline-block border-2 border-foreground bg-background px-4 py-2 font-pixel-line text-xl font-bold tracking-tight text-foreground md:text-2xl">
          {title}
        </h3>
        <SimulationChip />
      </div>
      <p className="mt-3 max-w-2xl font-mono text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  )
}

/** The drawing's title block: the four layer specs. */
function TitleBlock() {
  const layer = getLayer(6)
  return (
    <div className="relative mt-8 border border-border bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className={LABEL}>Specifications</span>
        <span className={LABEL}>Sheet {layer.ghost}</span>
      </div>
      <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {layer.specs.map((spec) => (
          <div key={spec.label} className="bg-background px-4 py-3">
            <dt className={LABEL}>{spec.label}</dt>
            <dd className="mt-1 font-mono text-sm font-bold text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Layer 6 · Transport & Bridge: Priority Seek Board + Thin Bridge. */
export function Layer6() {
  return (
    <LayerSection
      n={6}
      variant="stamp"
      className="overflow-x-clip"
      aside={
        <p className="max-w-3xl border-l border-foreground pl-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {"Works with existing mesh networks and stacks like Meshtastic, MeshCore and Reticulum (examples; the real list lives in the Knowledge Layer)"}
        </p>
      }
    >
      <div className="relative border border-border p-4 md:p-6 lg:p-8">
        <BlueprintGrid />
        <div className="relative">
          <StampTitle
            title="Priority Seek Board"
            caption="Set which networks are in range, then press SEEK. The node walks its short preferred list from the top and joins the first network it hears. With none in range, messages wait on the device."
          />
          <SeekBoard />
          <TitleBlock />
        </div>
      </div>

      <div className="mt-16 lg:mt-24">
        <StampTitle
          title="Thin Bridge"
          caption="Radio and Wi-Fi cannot hear each other, so a thin bridge sits between them. Press a network to drop a sealed packet through: at the bridge only its outer wrapper changes, and the payload is never opened."
        />
        <ThinBridge />
      </div>
    </LayerSection>
  )
}
