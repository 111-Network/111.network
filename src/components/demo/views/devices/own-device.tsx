// This laptop's own row at the top of Devices: the node itself, not something attached to it (the
// real list marks the caller's own record "this browser"; here the dashboard runs on the node). Plain
// device words only (W5). The Bridge row follows the bootstrap rule (plan §6.8): it says
// "also bridges radio and Wi-Fi" only while the facts show a live radio plus Wi-Fi that can host a
// hotspot (or ethernet), and otherwise says what is still missing.
import { DEVICES_COPY } from "../../copy/devices"
import { useDemo, useDemoWorld, useWorld } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { layerPageTitle, ownDevice } from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import { useHeadingLevel } from "../../shell/context"
import { RouteLink } from "../../shell/links"
import { Badge } from "../../ui/badge"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { SpecTable } from "../../ui/spec-table"
import { StatusDot } from "../../ui/status-dot"
import { AgentButton } from "./agent-button"
import { ownBridgeText } from "./model"

const selectHasRadio = (s: DemoState): boolean => s.core.radio !== null

export function OwnDevicePanel() {
  const own = useDemoWorld(ownDevice)
  const world = useWorld()
  const hasRadio = useDemo(selectHasRadio)
  const level = useHeadingLevel(1)
  const o = DEVICES_COPY.own
  const identity = layerPageTitle(2)

  return (
    <Panel as="section" title={o.panel} suffix={o.suffix} bodyClassName="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Heading level={level} className="font-mono text-sm text-foreground">
            {own.name}
          </Heading>
          <Badge>{own.badge}</Badge>
          <Badge>{o.badge}</Badge>
          <StatusDot state={own.health} />
        </div>
        <p className="max-w-prose font-mono text-xs leading-relaxed text-muted-foreground">{o.caption}</p>
      </div>

      <SpecTable
        rows={[
          { label: o.rows.device, value: own.deviceLabel },
          { label: o.rows.label, value: <span className="break-all">{own.label}</span> },
          { label: o.rows.has, value: own.facts.join(" · ") },
          {
            label: o.rows.bridge,
            value: (
              <span className="inline-flex flex-col items-end gap-1">
                <span>{ownBridgeText(own.bridges, world.self.facts, hasRadio)}</span>
                {own.bridges ? (
                  <RouteLink to={PATHS.service("bridge")} className="inline-flex min-h-11 items-center">
                    {o.openBridge}
                  </RouteLink>
                ) : null}
              </span>
            ),
          },
        ]}
      />

      <div className="flex flex-col gap-3">
        <p className="font-mono text-[11px] leading-snug text-muted-foreground">
          {o.nameHint}{" "}
          <RouteLink to={PATHS.settingsLayer(2)} className="inline-flex min-h-11 items-center">
            {identity}
          </RouteLink>
        </p>
        <AgentButton variant="default" label={o.ask} prompt={o.askPrompt} from={o.from} />
      </div>
    </Panel>
  )
}
