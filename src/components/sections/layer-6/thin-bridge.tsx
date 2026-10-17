"use client"

import { useEffect, useId, useReducer, useRef, type CSSProperties } from "react"
import { LiveLine } from "@/components/common/live-line"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { prefersReducedMotion } from "@/lib/motion"
import { cn } from "@/lib/utils"
import {
  BRIDGE_DOES,
  BRIDGE_DOES_NOT,
  BRIDGE_SIDES,
  INITIAL_BRIDGE,
  REFUSED_LINE,
  TRAVEL_MS,
  bridgeDelay,
  bridgeNarration,
  bridgeReducer,
  packetSpot,
  type Packet,
  type PacketSpot,
  type Side,
} from "./model"

// Band heights live in CSS variables on the stack, so the packet's stops are
// exact at every breakpoint: tall network, thin bridge, tall network.
const STACK_VARS = "[--band-h:8rem] md:[--band-h:10rem] [--bridge-h:4rem] [--pkt-h:3rem]"

/** The packet's top edge for each stop (centred in its band). */
const SPOT_Y: Record<PacketSpot, string> = {
  a: "calc((var(--band-h) - var(--pkt-h)) / 2)",
  bridge: "calc(var(--band-h) + (var(--bridge-h) - var(--pkt-h)) / 2)",
  b: "calc(var(--band-h) + var(--bridge-h) + (var(--band-h) - var(--pkt-h)) / 2)",
}

/** Content row inside a full-bleed band, aligned with the page container; the right side is the packet lane. */
const BAND_INNER = "mx-auto flex w-full max-w-7xl items-center px-4 lg:px-8"
const LANE_GAP = "max-w-[calc(100%_-_11rem)]"

const NETWORK_BAND = cn(
  "group flex h-[var(--band-h)] w-full items-center border-border bg-secondary/40 text-left font-mono text-muted-foreground transition-colors duration-200",
  "hover:bg-secondary hover:text-foreground",
  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground focus-visible:outline-none",
)

function PacketView({ packet, swapping }: { packet: Packet; swapping: boolean }) {
  const side = BRIDGE_SIDES[packet.wrapper]
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col justify-between border border-foreground bg-background p-1.5 font-mono",
        packet.wrapper === "a" ? "border-dashed" : "border-solid",
      )}
    >
      <span
        className={cn(
          "truncate px-0.5 text-[9px] leading-tight transition-colors duration-200",
          swapping ? "bg-foreground text-background" : "text-muted-foreground",
        )}
      >
        outer: {side.medium}
      </span>
      <span className="flex items-center justify-between gap-2 bg-foreground px-1 text-[9px] leading-tight text-background">
        <span>SEALED</span>
        <span aria-hidden="true" className="tracking-tighter">
          {packet.payload}
        </span>
      </span>
    </div>
  )
}

/**
 * Component B, the Thin Bridge (V10 LayerCake, remixed): two tall networks
 * that cannot hear each other and one thin bridge band between them. A click
 * on a network drops a sealed packet through; at the bridge only the outer
 * wrapper swaps. What the bridge does and does not do starts open; the bridge
 * band folds it away and back.
 */
export function ThinBridge() {
  const rootRef = useRef<HTMLDivElement>(null)
  const play = useInViewPlay(rootRef)
  const [state, dispatch] = useReducer(bridgeReducer, INITIAL_BRIDGE)
  const detailId = useId()

  // One timer per trip step, armed only while a packet is moving and the bridge is in view.
  useEffect(() => {
    const delay = bridgeDelay(state)
    if (delay === null || !play) return
    const id = window.setTimeout(() => dispatch({ type: "step" }), delay)
    return () => window.clearTimeout(id)
  }, [state, play])

  const send = (from: Side) => dispatch({ type: "send", from, instant: prefersReducedMotion() })
  const spot = packetSpot(state)

  const packetStyle: CSSProperties | undefined = spot
    ? { translate: `0 ${SPOT_Y[spot]}`, transitionDuration: `${TRAVEL_MS}ms` }
    : undefined

  return (
    <div ref={rootRef}>
      <div className={cn("relative mx-[calc(50%_-_50vw)]", STACK_VARS)}>
        <button
          type="button"
          onClick={() => send("a")}
          aria-label={`${BRIDGE_SIDES.a.name}, ${BRIDGE_SIDES.a.medium}: drop a sealed packet down through the bridge`}
          className={cn(NETWORK_BAND, "border-t")}
        >
          <span className={BAND_INNER}>
            <span className={cn("flex flex-col gap-1", LANE_GAP)}>
              <span className="font-pixel-line text-2xl font-bold tracking-tight md:text-4xl">NETWORK A</span>
              <span className="text-[10px] uppercase tracking-widest">{BRIDGE_SIDES.a.medium}</span>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                {/* A no-break space keeps the arrow on the line with its last word. */}
                press: drop a sealed packet&nbsp;↓
              </span>
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => dispatch({ type: "toggle-detail" })}
          aria-expanded={state.detailOpen}
          aria-controls={detailId}
          aria-label="Bridge: what it does and does not do"
          className={cn(
            "group flex h-[var(--bridge-h)] w-full items-center bg-foreground text-left font-mono text-background transition-colors duration-200 hover:bg-foreground/90",
            // The band's edges touch the dark networks and the screen edges, so a ring
            // there is lost: draw a black frame well inside the white band instead.
            "focus-visible:outline-2 focus-visible:-outline-offset-6 focus-visible:outline-background focus-visible:outline-solid",
          )}
        >
          <span className={BAND_INNER}>
            <span className={cn("flex flex-wrap items-baseline gap-x-3", LANE_GAP)}>
              <span className="font-pixel-line text-lg font-bold tracking-tight md:text-xl">
                BRIDGE{" "}
                {/* Geist Mono, not the pixel face: the pixel face has ▲ but no ▼. */}
                <span aria-hidden="true" className="font-mono text-sm font-normal">
                  {state.detailOpen ? "▲" : "▼"}
                </span>
              </span>
              <span className="hidden text-[10px] text-background/70 sm:inline">only the wrapper changes</span>
              <span className="text-[10px] text-background/70 group-hover:text-background">
                {state.detailOpen ? "press: hide the detail" : "press: does / does not"}
              </span>
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => send("b")}
          aria-label={`${BRIDGE_SIDES.b.name}, ${BRIDGE_SIDES.b.medium}: send a sealed packet up through the bridge`}
          className={cn(NETWORK_BAND, "border-b")}
        >
          <span className={BAND_INNER}>
            <span className={cn("flex flex-col gap-1", LANE_GAP)}>
              <span className="font-pixel-line text-2xl font-bold tracking-tight md:text-4xl">NETWORK B</span>
              <span className="text-[10px] uppercase tracking-widest">{BRIDGE_SIDES.b.medium}</span>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground">press: send one back up&nbsp;↑</span>
            </span>
          </span>
        </button>

        {state.packet && spot ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="relative mx-auto h-full max-w-7xl">
              <div
                style={packetStyle}
                className={cn(
                  "absolute top-0 right-4 h-[var(--pkt-h)] w-40 ease-in-out motion-reduce:transition-none lg:right-8",
                  state.stage === "launch" ? "transition-none" : "transition-[translate]",
                )}
              >
                <PacketView packet={state.packet} swapping={state.stage === "swap"} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div id={detailId} hidden={!state.detailOpen} className="mt-6 border border-foreground p-4 md:p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Bridge detail</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 font-mono text-xs leading-relaxed sm:grid-cols-[auto_1fr]">
          <dt className="font-bold text-foreground">does:</dt>
          <dd className="text-muted-foreground">{BRIDGE_DOES}</dd>
          <dt className="font-bold text-foreground">does not:</dt>
          <dd className="text-muted-foreground">{BRIDGE_DOES_NOT}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "do-more" })}
            className={cn(
              "inline-flex min-h-11 items-center border border-border px-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:border-foreground hover:text-foreground sm:min-h-8",
              "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none",
            )}
          >
            MAKE THE BRIDGE DO MORE
          </button>
          {state.refusals > 0 ? (
            // Remounted per press, so every refusal visibly shakes once (off under reduced motion).
            <span
              key={state.refusals}
              className="animate-glitch-once border-2 border-foreground px-3 py-1 font-mono text-xs font-bold text-foreground"
            >
              {REFUSED_LINE}
            </span>
          ) : null}
        </div>
      </div>

      <LiveLine className="mt-4 min-h-8 text-xs leading-relaxed text-foreground">{bridgeNarration(state)}</LiveLine>
    </div>
  )
}
