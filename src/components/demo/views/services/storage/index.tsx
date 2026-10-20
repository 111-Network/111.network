// Storage service page (#/services/storage, Layer 8; plan §6.4 Storage, W3, §6.8). Real sources:
// os/4-interface/ui/src/views/services/fabric.tsx (the "store ~ encrypted" panel: gauge, full and
// prune sentences) and store-gauge.tsx, in plain words, plus the intended Layer 8 surfaces from
// os/README.md: classes, the free-space order, hubs that host the big libraries, the optional
// append-only shared log.
//
// The one demo action is "[DEMO] fetch the regional map" from the home hub over Wi-Fi. Its steps run
// in the storage slice through the scheduler; nothing here keeps a timer, and nothing moves while
// idle. Under reduced motion the fetch lands in its end state at once. The shell's live region
// announces every step the slice emits, so the narration line here is not a live region.
import { useId } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { getLayer } from "@/lib/layers"
import { DEMO_ACTIONS } from "../../../copy/core"
import { STORAGE_COPY } from "../../../copy/storage"
import { useDemo, useDispatch, useWorld } from "../../../engine/react"
import { selectHeard, serviceById } from "../../../engine/selectors"
import type { DemoState } from "../../../engine/slices"
import { fetchLine, homeHubName, isRunning, type StorageState } from "../../../engine/slices/storage"
import { nodeName } from "../../../engine/world"
import { useHeadingLevel } from "../../../shell/context"
import { selectMode } from "../../../shell/select"
import type { ServiceViewProps } from "../../../shell/view-types"
import { DemoButton } from "../../../ui/demo-button"
import { DemoNote } from "../../../ui/demo-note"
import type { HeadingLevel } from "../../../ui/heading"
import { MiniTerminal } from "../../../ui/mini-terminal"
import { Panel } from "../../../ui/panel"
import { SpecTable, type SpecRow } from "../../../ui/spec-table"
import { ServicePageFrame } from "../frame"
import { logLines, mapOnHub, radioHubs } from "./model"
import { FreeOrder, HubRow, StoreClasses, StoreGauge } from "./parts"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"

const selectStorage = (s: DemoState): StorageState => s.storage
const selectStorageService = (s: DemoState) => serviceById(s, "storage")

/** A panel's hidden heading is never an h1. */
const sectionLevel = (h: HeadingLevel): Exclude<HeadingLevel, 1> => (h === 1 ? 2 : h)

/** The Layer 8 specs (src/lib/layers.ts, the home page's), with the store's own facts between them. */
function specRows(): SpecRow[] {
  const [store, pruning, hubs, sharedLog] = getLayer(8).specs
  const s = STORAGE_COPY.specs
  return [
    { label: store.label, value: store.value },
    { label: s.key, value: s.keyValue, minMode: "advanced" },
    { label: pruning.label, value: pruning.value },
    { label: s.timers, value: s.timersValue },
    { label: s.withinRule, value: s.withinRuleValue, minMode: "advanced" },
    { label: s.perSender, value: s.perSenderValue, minMode: "advanced" },
    { label: hubs.label, value: hubs.value },
    { label: sharedLog.label, value: sharedLog.value },
  ]
}

const SPEC_ROWS = specRows()

/** "[DEMO] fetch the regional map": busy while the fetch runs (focus stays on it), done once the map is here. */
function FetchControl({ noteId }: { noteId: string }) {
  const storage = useDemo(selectStorage)
  const service = useDemo(selectStorageService)
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const world = useWorld()
  const phase = storage.fetch.phase
  const busy = isRunning(phase) || phase === "paused"
  const finished = phase === "done" || phase === "declined"
  const live = service?.state === "live"
  const f = STORAGE_COPY.fetch
  const note = finished ? f.already : !live && !busy ? f.notLive : `${f.source(homeHubName(world))} ${f.radio}`
  return (
    <>
      <DemoButton
        loading={busy}
        aria-disabled={finished || (!live && !busy) || undefined}
        aria-describedby={noteId}
        onClick={() => dispatch({ type: "storage/fetchMap", instant: reduced })}
      >
        {DEMO_ACTIONS.fetchMap}
      </DemoButton>
      <p id={noteId} className={TEXT}>
        {phase === "declined" ? f.declined : note}
      </p>
    </>
  )
}

/** Where the fetch is now, in one sentence; the map is an incoming demo item, so it carries the note. */
function FetchStatus() {
  const storage = useDemo(selectStorage)
  const world = useWorld()
  const line = fetchLine(storage, homeHubName(world))
  if (line === null) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-s-2 border-foreground ps-3">
      <p className="font-mono text-sm leading-relaxed text-foreground">{line}</p>
      <DemoNote />
    </div>
  )
}

function StorageBody() {
  const storage = useDemo(selectStorage)
  const mode = useDemo(selectMode)
  const heard = useDemo(selectHeard)
  const world = useWorld()
  const h = sectionLevel(useHeadingLevel(1))
  const hub = homeHubName(world)
  const farHubs = radioHubs(heard, world)
  const g = STORAGE_COPY.gauge
  const hubs = STORAGE_COPY.hubs
  const log = STORAGE_COPY.log

  return (
    <div className="flex flex-col gap-6">
      <FetchStatus />

      <div className="grid grid-cols-1 gap-6 @min-[1024px]:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={g.title} suffix={g.suffix} heading={h} bodyClassName="flex flex-col gap-4">
            <StoreGauge storage={storage} />
            <SpecTable rows={SPEC_ROWS} mode={mode} />
            <p className={TEXT}>{STORAGE_COPY.sharedLog}</p>
          </Panel>

          <Panel title={STORAGE_COPY.classes.title} suffix={STORAGE_COPY.classes.suffix} heading={h} flush>
            <StoreClasses storage={storage} />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={STORAGE_COPY.order.title} suffix={STORAGE_COPY.order.suffix} heading={h}>
            <FreeOrder storage={storage} />
          </Panel>

          <Panel title={hubs.title} suffix={hubs.suffix} heading={h} flush>
            <p className={`${TEXT} px-4 pt-3`}>{hubs.intro}</p>
            <ul className="divide-y divide-border">
              <HubRow name={hub} where={hubs.home} body={hubs.homeHosts(hubs.shelf)} detail={`${hubs.map}: ${hubs.mapState[mapOnHub(storage)]}`} />
              {farHubs.map((entry) => (
                <HubRow key={entry.id} name={nodeName(world, entry.id)} where={hubs.radio} body={hubs.radioBody} note />
              ))}
            </ul>
            {farHubs.length === 0 ? <p className={`${TEXT} border-t border-border px-4 py-3`}>{hubs.radioNotHeard}</p> : null}
          </Panel>

          <MiniTerminal title={log.title} suffix={log.suffix} lines={logLines(storage)} emptyText={log.empty} maxHeightClass="max-h-40" />
        </div>
      </div>
    </div>
  )
}

export default function StoragePage({ id }: ServiceViewProps) {
  const noteId = useId()
  return (
    <ServicePageFrame id={id} actions={<FetchControl noteId={noteId} />}>
      <StorageBody />
    </ServicePageFrame>
  )
}
