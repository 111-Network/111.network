import { LayerSection } from "@/components/common/layer-section"
import { Panel } from "@/components/common/panel"
import { getLayer, type LayerSpec } from "@/lib/layers"
import { CardFields } from "./card-fields"
import { IdentityBench } from "./identity-bench"

const LABEL = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

/** Decorative machine-readable strip along the card's reverse. */
const READ_STRIP = "NODE<<ISSUED<BY<NOBODY<<NO<PHONE<<NO<EMAIL<<NO<REGISTRY<<<<<<<<<<<<<<<<<<<<<<<<"

/** The fine print: what the bench shows, in plain words. */
const NOTES: readonly { term: string; text: string }[] = [
  {
    term: "Label",
    text: "Display only: a short name to read out loud, never proof. Anyone can print a label; a peer trusts the key it pinned first.",
  },
  {
    term: "Seal",
    text: "Every announcement carries the node's seal. Its key vouches for the node, and a changed word breaks it.",
  },
  {
    term: "Gateway",
    text: "When the node acts as a gateway, the same keypair anchors it on the global network.",
  },
  {
    term: "Backup",
    text: "Optional. Everything works without one.",
  },
  {
    term: "Demo checksum",
    text: "The tamper step uses a toy checksum as a stand-in for the real signature.",
  },
]

/** The four layer specs, printed as the reverse of the ID card. */
function CardReverse({ specs }: { specs: readonly LayerSpec[] }) {
  return (
    <Panel className="min-w-0 lg:self-start">
      <div className="border-b border-border px-4 py-2">
        <h3 className={LABEL}>reverse of the card</h3>
      </div>
      <dl className="grid gap-px bg-border sm:grid-cols-2">
        {specs.map((spec) => (
          <div key={spec.label} className="bg-card px-4 py-3">
            <dt className={LABEL}>{spec.label}</dt>
            <dd className="mt-1 font-mono text-sm font-bold text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
      <p
        aria-hidden="true"
        className="overflow-hidden border-t border-border px-4 py-2 font-mono text-[10px] tracking-[0.2em] whitespace-nowrap text-muted-foreground"
      >
        {READ_STRIP}
      </p>
    </Panel>
  )
}

/** Plain-word notes beside the reverse. */
function FinePrint() {
  return (
    <div className="min-w-0">
      <h3 className={LABEL}>fine print</h3>
      <ul className="mt-4 space-y-3 font-mono text-xs leading-relaxed text-muted-foreground">
        {NOTES.map((note) => (
          <li key={note.term} className="flex gap-2">
            <span aria-hidden="true">{">"}</span>
            <span>
              <span className="text-foreground">{note.term}.</span> {note.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Layer 2 · Identity: "Issued By Nobody", a printed ID card and a peer that checks its seal. */
export function Layer2() {
  const { specs } = getLayer(2)
  return (
    <LayerSection n={2}>
      <IdentityBench cardFields={<CardFields />} />
      {/* grid-cols-1 (minmax(0, 1fr)) and min-w-0: the nowrap read strip must clip
          inside its panel, never widen the track past a phone's viewport. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <CardReverse specs={specs} />
        <FinePrint />
      </div>
    </LayerSection>
  )
}
