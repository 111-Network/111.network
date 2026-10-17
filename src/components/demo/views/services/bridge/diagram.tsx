// The bridge diagram (plan §5 L6 "Thin Bridge", §6.4 Bridge): two networks and one thin bridge band
// between them, each a full-width <button> that opens its detail. "[DEMO] pass a sealed message
// across" sends one sample message through, stepped by the scheduler (bridge/cross -> crossStep:
// in -> swap -> out): only the OUTER WRAPPER changes at the bridge, the payload never does (its label
// is the same on both sides). Reduced motion: the crossing lands at its end at once. The message is a
// sample, so it carries its "demo message" note. Bridges stay thin: the detail says what the bridge
// does not do, and the buffer sentence is the plan's, verbatim (copy/core BRIDGE_REASON.buffer).
import { useId, type ReactNode } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { BRIDGE_COPY } from "../../../copy/bridge"
import { BRIDGE_REASON } from "../../../copy/core"
import { useDemo, useDispatch, useWorld } from "../../../engine/react"
import { selectServices } from "../../../engine/selectors"
import { useHeadingLevel } from "../../../shell/context"
import { crossingUnderWay, type BridgeBand, type CrossDirection, type Crossing } from "../../../engine/slices/bridge"
import { DemoButton } from "../../../ui/demo-button"
import { DemoNote } from "../../../ui/demo-note"
import { Disclosure } from "../../../ui/disclosure"
import { FOCUS_RING, FOCUS_RING_OFFSET, LABEL_CLASS } from "../../../ui/classes"
import { Heading, type HeadingLevel } from "../../../ui/heading"
import { Panel } from "../../../ui/panel"
import { Segmented } from "../../../ui/segmented"
import { SpecTable } from "../../../ui/spec-table"
import { crossCaption, packetBand, payloadLabel, wrapperText } from "./model"
import { selectBridgeSlice, selectTransport } from "./select"

const D = BRIDGE_COPY.diagram
const NOTE = "max-w-prose font-mono text-xs leading-relaxed text-muted-foreground"

const DIRECTIONS: readonly { value: CrossDirection; label: string }[] = [
  { value: "radio-to-wifi", label: D.directions["radio-to-wifi"] },
  { value: "wifi-to-radio", label: D.directions["wifi-to-radio"] },
]

/** The sample message where it is now: its outer wrapper, then the sealed payload that never changes. */
function Packet({ crossing, label, inverted }: { crossing: Crossing; label: string; inverted: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 border px-3 py-2 font-mono text-[11px] leading-snug", inverted ? "border-background" : "border-foreground")}>
      <span className={inverted ? "text-background" : "text-foreground"}>{wrapperText(crossing)}</span>
      <span className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className={cn("h-2 w-2 shrink-0", inverted ? "bg-background" : "bg-foreground")} />
        <span>{`${D.payload} ${label}`}</span>
        <span>{`· ${D.unchanged}`}</span>
        <DemoNote kind="message" className={inverted ? "border-background text-background" : undefined} />
      </span>
    </div>
  )
}

interface BandProps {
  band: BridgeBand
  title: string
  sub: string
  selected: boolean
  controls: string
  onSelect: (band: BridgeBand) => void
  children?: ReactNode
}

/** One band: a full-width button (title and line) and, below it, the sample message when it is here. */
function Band({ band, title, sub, selected, controls, onSelect, children }: BandProps) {
  const thin = band === "bridge"
  return (
    <div className={cn("flex flex-col border", thin ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>
      <button
        type="button"
        aria-pressed={selected}
        aria-controls={controls}
        onClick={() => onSelect(band)}
        className={cn(
          "flex w-full flex-col items-start gap-1 px-4 text-start font-mono transition-colors duration-200",
          thin ? cn("min-h-11 py-2", FOCUS_RING_OFFSET) : cn("min-h-24 py-4 hover:text-foreground", FOCUS_RING),
        )}
      >
        <span className={cn("flex items-center gap-2 text-xs uppercase tracking-widest", thin ? "text-background" : "text-foreground")}>
          <span aria-hidden="true" className={cn("w-3", selected ? "" : "invisible")}>
            {"▶"}
          </span>
          {title}
        </span>
        <span className="ps-5 text-[11px] leading-snug">{sub}</span>
      </button>
      {children ? <div className="px-4 pb-3 ps-9">{children}</div> : null}
    </div>
  )
}

/** The selected band's detail. */
function BandDetail({ band, level }: { band: BridgeBand; level: HeadingLevel }) {
  const bands = D.bands
  if (band === "radio") {
    return (
      <>
        <Heading level={level} className={LABEL_CLASS}>
          {bands.radio.title}
        </Heading>
        <p className={NOTE}>{D.detail.radio}</p>
      </>
    )
  }
  if (band === "wifi") {
    return (
      <>
        <Heading level={level} className={LABEL_CLASS}>
          {bands.wifi.title}
        </Heading>
        <p className={NOTE}>{D.detail.wifi}</p>
      </>
    )
  }
  return (
    <>
      <Heading level={level} className={LABEL_CLASS}>
        {bands.bridge.title}
      </Heading>
      <SpecTable
        bare
        rows={[
          { label: D.detail.does, value: D.detail.doesValue },
          { label: D.detail.doesNot, value: D.detail.doesNotValue },
          { label: D.detail.translates, value: D.detail.translatesValue },
          { label: D.detail.buffer, value: BRIDGE_REASON.buffer },
        ]}
      />
    </>
  )
}

export function DiagramPanel() {
  const level = useHeadingLevel(1)
  const detailLevel = useHeadingLevel(2)
  const slice = useDemo(selectBridgeSlice)
  const services = useDemo(selectServices)
  const transport = useDemo(selectTransport)
  const world = useWorld()
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const detailId = useId()

  const on = services.find((s) => s.id === "bridge")?.state === "live"
  const crossing = slice.crossing
  const under = crossingUnderWay(crossing)
  const at = packetBand(crossing)
  const label = crossing ? payloadLabel(world, crossing) : ""
  const radioNet = world.networks.find((n) => n.medium === "radio")
  const joinedName = radioNet && transport.joined === radioNet.id ? radioNet.name : null
  const radioSub = radioNet ? (joinedName ? D.bands.radio.joined(radioNet.name) : D.bands.radio.notJoined(radioNet.name)) : ""
  const select = (band: BridgeBand) => dispatch({ type: "bridge/select", band })
  const packetIn = (band: BridgeBand) => (crossing && at === band ? <Packet crossing={crossing} label={label} inverted={band === "bridge"} /> : null)

  return (
    <Panel title={D.title} suffix={D.suffix} bodyClassName="space-y-4">
      <Heading level={level} className="font-mono text-sm leading-relaxed text-foreground">
        {D.heading}
      </Heading>

      <div className="grid grid-cols-1 gap-4 @min-[768px]:grid-cols-2">
        <div role="group" aria-label={D.bandsLabel} className="flex flex-col">
          <Band band="radio" title={D.bands.radio.title} sub={radioSub} selected={slice.selected === "radio"} controls={detailId} onSelect={select}>
            {packetIn("radio")}
          </Band>
          <Band
            band="bridge"
            title={D.bands.bridge.title}
            sub={`${D.bands.bridge.sub} · ${on ? D.bands.bridge.on : D.bands.bridge.off}`}
            selected={slice.selected === "bridge"}
            controls={detailId}
            onSelect={select}
          >
            {packetIn("bridge")}
          </Band>
          <Band band="wifi" title={D.bands.wifi.title} sub={D.bands.wifi.sub} selected={slice.selected === "wifi"} controls={detailId} onSelect={select}>
            {packetIn("wifi")}
          </Band>
        </div>

        <div id={detailId} className="space-y-3 border border-border p-4">
          <BandDetail band={slice.selected} level={detailLevel} />
        </div>
      </div>

      <p className="font-mono text-xs leading-relaxed text-foreground">{crossing ? crossCaption(crossing) : D.idle}</p>

      <div className="flex flex-col gap-3 @min-[640px]:flex-row @min-[640px]:flex-wrap @min-[640px]:items-center">
        <Segmented<CrossDirection>
          label={D.direction}
          value={slice.direction}
          options={DIRECTIONS}
          onChange={(direction) => dispatch({ type: "bridge/direction", direction })}
          size="sm"
        />
        {on ? (
          <DemoButton loading={under} onClick={() => dispatch({ type: "bridge/cross", instant: reduced })}>
            {D.cross}
          </DemoButton>
        ) : (
          <p className={NOTE}>{D.needsOn}</p>
        )}
      </div>

      <Disclosure summary={D.thinSummary}>
        <p className={NOTE}>{D.thinBody}</p>
      </Disclosure>
    </Panel>
  )
}
