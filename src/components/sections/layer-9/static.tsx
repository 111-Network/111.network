import { getLayer } from "@/lib/layers"

// Server-rendered parts of Layer 9: the four specs (as the pull request's
// sidebar, V6's info pane) and the evolution tiles under the bench.

/** The four Layer 9 specs as a forge-style sidebar: label over bold value. */
export function PrSpecs() {
  const { specs } = getLayer(9)
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-foreground" />
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Specifications</p>
      </div>
      <dl className="divide-y divide-border">
        {specs.map((spec) => (
          <div key={spec.label} className="flex flex-col gap-0.5 py-3 font-mono text-xs">
            <dt className="text-[10px] text-muted-foreground">{spec.label}</dt>
            <dd className="font-bold text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const EVOLUTION = [
  { title: "AGENT", line: "The same loop can update the agent itself, so the node grows more capable over time." },
  { title: "KNOWLEDGE", line: "Each proven repair expands the Knowledge Layer that every other layer reads from." },
  { title: "BRIDGES", line: "Bridging logic is refined the same way, on the devices that run a bridge." },
] as const

/** AGENT · KNOWLEDGE · BRIDGES: what the same loop improves over time. */
export function EvolutionTiles() {
  return (
    <div className="mt-12 md:mt-16">
      <h3 id="layer-9-evolution" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Evolution · the same loop improves
      </h3>
      <ul className="mt-4 grid gap-4 md:grid-cols-3">
        {EVOLUTION.map((tile) => (
          <li key={tile.title} className="border border-border bg-card p-6 shadow-panel">
            <h4 className="font-pixel-line text-2xl font-bold text-foreground md:text-3xl">{tile.title}</h4>
            <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">{tile.line}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[10px] text-muted-foreground">
        Always scoped to the layers the device runs, and always with a person at the final gate.
      </p>
    </div>
  )
}
