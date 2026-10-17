// Install & updates · L1: the update check with every step (real Essentials UpdateRow plus the
// `updating` mock scenario: staged -> probation -> healthy, or the rollback branch), then what the
// installer found on this device, in plain words (no category code, no install command, no number).
import { deviceById } from "@/lib/devices"
import { SETTINGS_COPY } from "../../copy/settings"
import { shallowEqual, useDemoWorld, useWorld } from "../../engine/react"
import { ownFactLines } from "../../engine/selectors"
import { useHeadingLevel } from "../../shell/context"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { SpecTable } from "../../ui/spec-table"
import { toSpecRows } from "./facts"
import type { FactRow } from "./model"
import { H2 } from "./row"
import { UpdatePanelBody } from "./update"

const C = SETTINGS_COPY

function ThisDevice() {
  const h1 = useHeadingLevel(1)
  const world = useWorld()
  const facts = useDemoWorld(ownFactLines, shallowEqual)
  const rows: FactRow[] = [
    { label: C.device.rows.device, value: deviceById(world.self.device).label },
    { label: C.device.rows.has, value: facts },
    { label: C.device.rows.setup, value: C.device.setupValue },
    { label: C.device.rows.telemetry, value: C.device.telemetryValue },
  ]
  return (
    <Panel title={C.device.panel} flush>
      <div className="border-b border-border px-4 py-3">
        <Heading level={h1} className={H2}>
          {C.device.heading}
        </Heading>
      </div>
      <SpecTable bare rows={toSpecRows(rows)} />
    </Panel>
  )
}

export function InstallPanels() {
  const h1 = useHeadingLevel(1)
  return (
    <>
      <Panel title={C.update.panel} suffix="l1">
        <Heading level={h1} className={H2}>
          {C.update.heading}
        </Heading>
        <div className="mt-3">
          <UpdatePanelBody />
        </div>
      </Panel>
      <ThisDevice />
    </>
  )
}
