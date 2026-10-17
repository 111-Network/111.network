// Identity · L2: the public card plate (name, grouped label, device, the public half drawn as bars,
// "private half stays here", "issued by nobody"), the node-name editor and the backup note. Plain
// words only: no key bytes, no hex, no recovery-word count, no backup command (plan §6.8, W3).
import { useId, type ReactNode } from "react"
import { deviceById } from "@/lib/devices"
import { cn } from "@/lib/utils"
import { SETTINGS_COPY } from "../../copy/settings"
import { useDemo, useWorld } from "../../engine/react"
import { useHeadingLevel } from "../../shell/context"
import { selectAlias } from "../../shell/select"
import { CopyButton } from "../../ui/copy-button"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { AliasForm } from "./alias-form"
import { keyBars } from "./model"
import { FEEDBACK, H2 } from "./row"

const C = SETTINGS_COPY.identity

const TERM = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
const VALUE = "min-w-0 break-words font-mono text-xs text-foreground"

function Field({ term, children, note }: { term: string; children: ReactNode; note?: string }) {
  return (
    <div className="grid gap-1 border-t border-border py-2.5 first:border-t-0 @min-[640px]:grid-cols-[9rem_minmax(0,1fr)] @min-[640px]:gap-4">
      <dt className={TERM}>{term}</dt>
      <dd className={VALUE}>
        {children}
        {note ? <p className={cn("mt-1 text-muted-foreground", FEEDBACK)}>{note}</p> : null}
      </dd>
    </div>
  )
}

/** The public half of this node's key drawn as a deterministic bar strip (never hex, never a glyph). */
function KeyStrip({ seed }: { seed: string }) {
  const bars = keyBars(seed)
  return (
    <span role="img" aria-label={C.publicImage} className="flex h-6 items-stretch">
      {bars.map((b, i) => (
        <span key={i} aria-hidden="true" className="bg-foreground" style={{ width: `${b.width * 2}px`, marginInlineEnd: `${b.gap * 2}px` }} />
      ))}
    </span>
  )
}

function Card() {
  const h1 = useHeadingLevel(1)
  const world = useWorld()
  const alias = useDemo(selectAlias)
  const self = world.self
  return (
    <Panel title={C.panel} suffix={C.cardSuffix}>
      <Heading level={h1} className={H2}>
        {C.cardHeading}
      </Heading>
      <div className="mt-3 border-2 border-foreground p-4">
        <p className={cn(TERM, "mb-2")}>{C.cardKicker}</p>
        <dl>
          <Field term={C.name}>{alias}</Field>
          <Field term={C.label} note={C.labelNote}>
            <span className="flex flex-wrap items-center gap-2">
              <span className="tracking-wider">{self.label}</span>
              <CopyButton text={self.label} ariaLabel={C.copyLabel} />
            </span>
          </Field>
          <Field term={C.device}>{deviceById(self.device).label}</Field>
          <Field term={C.publicHalf} note={C.publicNote}>
            <KeyStrip seed={self.label} />
          </Field>
          <Field term={C.privateHalf}>{C.staysHere}</Field>
          <Field term={C.issuedBy}>{C.nobody}</Field>
          <Field term={C.notNeededFields.join(" · ")}>{C.notNeeded}</Field>
          <Field term={C.backup}>{C.backupValue}</Field>
          <Field term={C.pinned}>{C.pinnedNote}</Field>
        </dl>
      </div>
    </Panel>
  )
}

export function IdentityPanels() {
  const h1 = useHeadingLevel(1)
  const inputId = useId()
  return (
    <>
      <Card />
      <Panel title={C.aliasPanel} suffix="l2">
        <Heading level={h1} className={cn(H2, "mb-3")}>
          {C.aliasHeading}
        </Heading>
        <p className={cn("mb-3 max-w-prose text-muted-foreground", FEEDBACK)}>{SETTINGS_COPY.rows.alias.help}</p>
        <AliasForm inputId={inputId} />
      </Panel>
      <Panel title={C.backupPanel} suffix="l2">
        <Heading level={h1} className={H2}>
          {C.backupHeading}
        </Heading>
        <p className={cn("mt-2 max-w-prose text-muted-foreground", FEEDBACK)}>{C.backupText}</p>
        <p className={cn("mt-2 max-w-prose text-muted-foreground", FEEDBACK)}>{SETTINGS_COPY.rows.backup.note}</p>
      </Panel>
    </>
  )
}
