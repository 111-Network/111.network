// Settings > one layer page (#/settings/l0 .. l9; real views/settings/layer-page.tsx): the plain
// description, the layer's own panels (Install & updates, Identity, the home hub), the status it
// owns today, how it works on this node, where it shows up on this dashboard, and "Ask the agent
// about {layer}". The ask puts a prepared question in the Agent's composer (core/agentPrefill); it
// is never sent by itself. No "configurable here (coming)" mark: all ten layers show as intended (W4).
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SETTINGS_COPY } from "../../copy/settings"
import { shallowEqual, useDemoWorld, useDispatch, useWorld } from "../../engine/react"
import type { LayerNumber } from "../../engine/types"
import { useHeadingLevel } from "../../shell/context"
import { RouteLink } from "../../shell/links"
import { Button } from "../../ui/button"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { SectionHeader } from "../../ui/section-header"
import { SpecTable } from "../../ui/spec-table"
import { toSpecRows } from "./facts"
import { layerAsk, layerDescription, layerLinks, layerPoints, layerStatusRows, layerTitle, selectLayerInputs } from "./model"
import { FEEDBACK, H2 } from "./row"

const C = SETTINGS_COPY.layer

export interface LayerPageProps {
  n: LayerNumber
  /** The layer's own panels, after "What it is". */
  children?: ReactNode
}

export function LayerPage({ n, children }: LayerPageProps) {
  const h = useHeadingLevel()
  const h1 = useHeadingLevel(1)
  const world = useWorld()
  const inputs = useDemoWorld(selectLayerInputs, shallowEqual)
  const dispatch = useDispatch()
  const title = layerTitle(n)
  const tag = `l${n}`

  const ask = () => dispatch({ type: "core/agentPrefill", ...layerAsk(n) })

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader level={h} kicker={C.kicker(n)} title={title} />

      <Panel title={tag} suffix={C.about}>
        <Heading level={h1} className={H2}>
          {C.aboutHeading}
        </Heading>
        <p className={cn("mt-2 max-w-prose text-muted-foreground", FEEDBACK)}>{layerDescription(n)}</p>
      </Panel>

      {children}

      <Panel title={C.status} suffix={tag} flush>
        <div className="border-b border-border px-4 py-3">
          <Heading level={h1} className={H2}>
            {C.statusHeading}
          </Heading>
        </div>
        <SpecTable bare rows={toSpecRows(layerStatusRows(n, inputs, world))} />
      </Panel>

      <Panel title={C.here} suffix={tag}>
        <Heading level={h1} className={H2}>
          {C.hereHeading}
        </Heading>
        <ul className="mt-3 flex max-w-prose flex-col gap-2">
          {layerPoints(n).map((point) => (
            <li key={point} className={cn("flex gap-3 text-muted-foreground", FEEDBACK)}>
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-foreground" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <Heading level={h1} className={cn("mt-6", H2)}>
          {C.whereHeading}
        </Heading>
        <ul className="mt-3 flex flex-col gap-1">
          {layerLinks(n).map((link) => (
            <li key={link.key} className={cn("flex min-h-11 flex-wrap items-center gap-x-2 @min-[1024px]:min-h-0", FEEDBACK)}>
              <RouteLink to={link.to}>{link.label}</RouteLink>
              <span className="text-muted-foreground">· {link.note}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={C.agent} suffix={tag}>
        <Heading level={h1} className={H2}>
          {C.askHeading}
        </Heading>
        <p className={cn("mt-2 max-w-prose text-muted-foreground", FEEDBACK)}>{C.askNote}</p>
        <div className="mt-4">
          <Button onClick={ask}>{C.ask(title)}</Button>
        </div>
      </Panel>
    </div>
  )
}
