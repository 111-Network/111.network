// Settings > Essentials (#/settings; real views/settings/essentials.tsx): five rows, then Sharing.
// Reachable in both modes. Every control writes to the demo store instead of the node's API:
// the name through core/renameNode, the mode through core/setMode, restart and the update check
// through the settings slice (scheduled steps). No backup command, no pair code, no loopback gate,
// no licenses row (plan §6.8, W6).
import { useId } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { SETTINGS_COPY } from "../../copy/settings"
import type { DemoState } from "../../engine/slices"
import { updateBusy, type LanState, type RestartState } from "../../engine/slices/settings"
import type { UiMode } from "../../engine/types"
import { useDemo, useDispatch } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { useAnnounce, useHeadingLevel } from "../../shell/context"
import { SHELL_COPY } from "../../shell/copy"
import { RouteLink } from "../../shell/links"
import { selectAlias, selectMode } from "../../shell/select"
import { Button } from "../../ui/button"
import { Panel } from "../../ui/panel"
import { SectionHeader } from "../../ui/section-header"
import { Segmented } from "../../ui/segmented"
import { Toggle } from "../../ui/toggle"
import { AliasForm } from "./alias-form"
import { essentialRows, lanAnnouncement, lanNote, restartConfirmText, type EssentialId } from "./model"
import { Feedback, FEEDBACK, Row } from "./row"
import { UpdateSummary } from "./update"

const C = SETTINGS_COPY

const MODE_OPTIONS = [
  { value: "simple", label: SHELL_COPY.mode.simple },
  { value: "advanced", label: SHELL_COPY.mode.advanced },
] as const satisfies readonly { value: UiMode; label: string }[]

const selectRestart = (s: DemoState): RestartState => s.settings.restart
const selectUpdating = (s: DemoState): boolean => updateBusy(s.settings.update)
const selectLan = (s: DemoState): LanState => s.settings.lan

function ModeRow() {
  const mode = useDemo(selectMode)
  const dispatch = useDispatch()
  return <Segmented<UiMode> label={C.rows.mode.label} value={mode} onChange={(next) => dispatch({ type: "core/setMode", mode: next })} options={MODE_OPTIONS} />
}

function BackupRow({ note }: { note: string }) {
  return (
    <div className="flex flex-col gap-2 border border-border bg-secondary/20 p-4">
      <p className={cn("text-muted-foreground", FEEDBACK)}>{note}</p>
      <p className={cn("flex min-h-11 flex-wrap items-center gap-x-1 @min-[1024px]:min-h-0", FEEDBACK)}>
        <RouteLink to={PATHS.settingsLayer(2)}>{C.where.identity.label}</RouteLink>
        <span className="text-muted-foreground">· {C.where.identity.note}</span>
      </p>
    </div>
  )
}

function RestartRow() {
  const alias = useDemo(selectAlias)
  const restart = useDemo(selectRestart)
  const updating = useDemo(selectUpdating)
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const restarting = restart.phase === "restarting"
  // The shell announces the restart events; these lines only show them.
  const line = restarting ? C.restart.restarting : updating ? C.restart.waitForUpdate : restart.phase === "back" ? C.restart.back : null
  return (
    <div>
      <Button
        variant="destructive"
        confirm={restartConfirmText(alias)}
        aria-disabled={restarting || updating || undefined}
        onClick={() => dispatch({ type: "settings/restart", instant: reduced })}
      >
        {C.restart.button}
      </Button>
      <Feedback text={line} strong={restarting} />
    </div>
  )
}

function SharingPanel({ uid }: { uid: string }) {
  const lan = useDemo(selectLan)
  const dispatch = useDispatch()
  const announce = useAnnounce()
  const note = lanNote(lan)
  const noteId = `${uid}-lan-note`

  const toggle = (enabled: boolean) => {
    dispatch({ type: "settings/setLan", enabled })
    announce(lanAnnouncement({ ...lan, enabled }))
  }

  return (
    <Panel title={C.sharing.panel} flush>
      <Row id={`${uid}-lan`} label={C.sharing.lan.label} help={C.sharing.lan.help}>
        <Toggle pressed={lan.enabled} onPressedChange={toggle} aria-describedby={note ? noteId : undefined} className="inline-flex items-center gap-2 text-xs">
          <span>{C.sharing.lan.toggle}</span> <span aria-hidden="true">{lan.enabled ? C.sharing.lan.on : C.sharing.lan.off}</span>
        </Toggle>
        {note ? (
          <p id={noteId} className={cn("mt-2 text-muted-foreground", FEEDBACK)}>
            {note}
          </p>
        ) : null}
      </Row>
      <Row id={`${uid}-offer`} label={C.sharing.offer.label} help={C.sharing.offer.help}>
        <p className={cn("text-foreground", FEEDBACK)}>
          <span className="text-muted-foreground">{C.sharing.offer.state}</span>
          {C.sharing.offer.accepted}
        </p>
      </Row>
    </Panel>
  )
}

export function Essentials() {
  const h = useHeadingLevel()
  const uid = useId()
  const rows = essentialRows()

  const control = (id: EssentialId, note?: string) => {
    switch (id) {
      case "alias":
        return <AliasForm labelledBy={`${uid}-alias-label`} inputId={`${uid}-alias-input`} />
      case "mode":
        return <ModeRow />
      case "backup":
        return <BackupRow note={note ?? ""} />
      case "restart":
        return <RestartRow />
      case "updates":
        return <UpdateSummary />
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader level={h} kicker={C.essentials.kicker} title={C.essentials.title} />
      <Panel title={C.essentials.panel} flush>
        {rows.map((r) => (
          <Row key={r.id} id={`${uid}-${r.id}`} label={r.label} help={r.help}>
            {control(r.id, r.note)}
          </Row>
        ))}
      </Panel>
      <SharingPanel uid={uid} />
    </div>
  )
}
