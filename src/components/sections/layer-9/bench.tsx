"use client"

import { useEffect, useReducer, useRef, type ReactNode } from "react"
import { LiveLine } from "@/components/common/live-line"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { useDevice } from "@/lib/device-store"
import type { DeviceId } from "@/lib/devices"
import { GateRail } from "./gate-rail"
import { HealthBoard } from "./health-board"
import {
  INITIAL_HEAL_STATE,
  hasPendingWork,
  healMode,
  healReducer,
  narrate,
  settle,
  type HealAction,
} from "./model"
import { PullRequest } from "./pull-request"

/** One agent step or one machine station per tick, only while the bench is on screen. */
const TICK_MS = 700

type VisitorAction = Exclude<HealAction, { type: "tick" }>

/** Props of HealBench. */
export interface HealBenchProps {
  /** The four layer specs, server-rendered, shown as the pull request's sidebar. */
  specs: ReactNode
}

/**
 * The L9 island: health board + agent log, the pull request and the gate rail,
 * all driven by one reducer (model.ts). It follows the page-level device; a
 * new device starts a fresh bench.
 */
export function HealBench({ specs }: HealBenchProps) {
  const device = useDevice()
  return <Bench key={device} device={device} specs={specs} />
}

function Bench({ device, specs }: { device: DeviceId; specs: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const play = useInViewPlay(rootRef)
  const reduced = useReducedMotion()
  const [state, dispatch] = useReducer(healReducer, INITIAL_HEAL_STATE)

  // Under reduced motion every lesson shows its resting state at once.
  const view = reduced ? settle(state) : state
  const enabled = healMode(device) !== "none"

  // The section's one JS loop: one tick timer, armed only after a click caused
  // machine work, only in view with the tab visible, never under reduced motion.
  // Keyed on the state, so every visitor action restarts the full step delay.
  useEffect(() => {
    if (!play || reduced || !hasPendingWork(state)) return
    const id = window.setTimeout(() => dispatch({ type: "tick" }), TICK_MS)
    return () => window.clearTimeout(id)
  }, [play, reduced, state])

  const act = (action: VisitorAction) => dispatch({ ...action, instant: reduced })

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <HealthBoard
            state={view}
            device={device}
            onBreak={(fault) => act({ type: "break", fault, device })}
            onBadFix={() => act({ type: "bad-fix" })}
            onGoodFix={() => act({ type: "good-fix" })}
            onDismiss={() => act({ type: "dismiss" })}
            onReset={() => act({ type: "reset" })}
          />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <PullRequest state={view} device={device} specs={specs} />
        </div>
      </div>

      <LiveLine className="border border-border bg-card px-4 py-3 text-xs leading-relaxed text-foreground">
        {narrate(view, device)}
      </LiveLine>

      <GateRail state={view} enabled={enabled} onPass={(index) => act({ type: "pass-gate", index })} />
    </div>
  )
}
