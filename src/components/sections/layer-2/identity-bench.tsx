"use client"

import { useId, useReducer, type ReactNode } from "react"
import { ChipGroup, type ChipOption } from "@/components/common/chip-group"
import { LiveLine } from "@/components/common/live-line"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { StatusDot } from "@/components/common/status-dot"
import { cn } from "@/lib/utils"
import { DecodingLabel } from "./decoding-label"
import { KeyBars } from "./key-bars"
import {
  benchReducer,
  claimsPinnedNode,
  demoChecksum,
  INITIAL_BENCH,
  keyNote,
  narrate,
  NODE_KEY,
  NODE_REF,
  peerLeads,
  SEAL_NOTE,
  sceneFor,
  STEPS,
  TEXT_MAX,
  verdictReason,
  type BenchAction,
  type BenchState,
  type Scene,
  type Stage,
} from "./model"
import { Seal } from "./seal"

const STEP_OPTIONS: readonly ChipOption<Stage>[] = STEPS

const LABEL = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

const SMALL_BUTTON = cn(
  "inline-flex min-h-11 items-center justify-center border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 sm:min-h-8",
  "hover:border-foreground hover:text-foreground",
  "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none",
  // aria-disabled, not disabled: a control that disables itself on click would drop focus.
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:text-muted-foreground",
)

/** Props of IdentityBench. */
export interface IdentityBenchProps {
  /** The card's static printed fields (a Server Component). */
  cardFields: ReactNode
}

/**
 * L2 "Issued By Nobody": a four-step bench. The card prints out of a slot on
 * the first click, a nearby peer checks what it hears, and the visitor can
 * tamper with the text or swap the key. Nothing moves until a click or a keystroke.
 */
export function IdentityBench({ cardFields }: IdentityBenchProps) {
  const [state, dispatch] = useReducer(benchReducer, INITIAL_BENCH)
  const scene = sceneFor(state.stage, state.text)

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className={LABEL}>identity bench · made on this device</span>
        <SimulationChip />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        {/* Keyed on START OVER: a fresh group forgets the last focused chip, so
            Tab lands on 1 INSTALL as the empty slot asks. */}
        <ChipGroup<Stage>
          key={state.resetCount}
          aria-label="identity step"
          value={state.stage}
          onValueChange={(stage) => {
            if (stage !== "idle") dispatch({ type: "select", step: stage })
          }}
          options={STEP_OPTIONS}
        />
        <button
          type="button"
          className={SMALL_BUTTON}
          aria-disabled={state.stage === "idle" ? true : undefined}
          onClick={() => dispatch({ type: "reset" })}
        >
          start over
        </button>
      </div>

      {/* Below lg the columns stack; from step 2 on the peer's panel moves up
          under the stepper, so each click's result shows next to it. */}
      <div className="grid grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-2 lg:gap-8">
        <CardColumn printed={scene.printed} printRun={state.printRun} fields={cardFields} />
        <PeerColumn
          state={state}
          scene={scene}
          dispatch={dispatch}
          className={peerLeads(state.stage) ? "order-first lg:order-none" : undefined}
        />
      </div>

      <div className="border-t border-border px-4 py-3">
        <LiveLine className="text-xs text-foreground">
          <span aria-hidden="true" className="text-muted-foreground">
            {"> "}
          </span>
          {narrate(state)}
        </LiveLine>
      </div>
    </Panel>
  )
}

// ── Left: the slot and the card ───────────────────────────────────────────

function CardColumn({ printed, printRun, fields }: { printed: boolean; printRun: number; fields: ReactNode }) {
  return (
    <div className="min-w-0">
      {/* The paper path, a little narrower than the slot: the card waits inside the
          housing and feeds up out of the slot, top edge (the label) first. */}
      <div className="relative mx-5 overflow-hidden">
        <div
          aria-hidden={printed ? true : undefined}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-b-0 border-dashed border-border px-4 text-center"
        >
          <p className={LABEL}>slot empty · nothing issued yet</p>
          <p className="font-mono text-xs text-foreground">press 1 INSTALL</p>
        </div>
        <article
          aria-label="node identity card"
          aria-hidden={printed ? undefined : true}
          className={cn(
            "relative border border-b-0 border-foreground bg-card transition-transform duration-700 ease-[steps(7,end)] motion-reduce:transition-none",
            printed ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest">node identity</span>
            <span className={LABEL}>made here</span>
          </div>
          <div className="px-4 pt-4 pb-4">
            <p className={LABEL}>label</p>
            <p className="mt-1 font-mono text-xl font-bold tracking-widest sm:text-2xl">
              <DecodingLabel printRun={printRun} />
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">display only · never proof of identity</p>
          </div>
          {fields}
        </article>
      </div>

      {/* The housing: the slot along its top edge, then the node's status. */}
      <div className="border border-border bg-secondary px-4 pb-3">
        <div aria-hidden="true" className="-mt-px h-2 border border-foreground bg-background" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className={LABEL}>this node</span>
          <StatusDot state={printed ? "live" : "unset"} className="text-foreground" />
        </div>
      </div>
    </div>
  )
}

// ── Right: the nearby peer ────────────────────────────────────────────────

function PeerColumn({
  state,
  scene,
  dispatch,
  className,
}: {
  state: BenchState
  scene: Scene
  dispatch: (action: BenchAction) => void
  className?: string
}) {
  const inputId = useId()
  const hintId = useId()
  const { heard, verdict } = scene
  // The peer knows the node by the key it pinned, never by its label.
  const pinned = scene.pins[NODE_REF]
  const impostor = claimsPinnedNode(scene)
  const recomputed = heard ? demoChecksum(heard.key, heard.text) : ""

  return (
    <div role="group" aria-label="nearby peer" className={cn("min-w-0 border border-border bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest">nearby peer</span>
        <span className={LABEL}>checks what it hears</span>
      </div>

      <div className="border-b border-border px-4 py-3">
        <p className={LABEL}>pinned keys</p>
        {pinned ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
            <span className="font-bold">this node</span>
            <KeyBars keyId={pinned} label="pinned: the node's own key" />
            {verdict?.pinnedNow ? (
              <span className="border border-foreground px-2 py-0.5 text-[10px] uppercase tracking-widest">pinned now</span>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 font-mono text-xs text-muted-foreground">nothing pinned yet</p>
        )}
      </div>

      <div className="border-b border-border px-4 py-3">
        <p className={LABEL}>heard</p>
        {heard && verdict ? (
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 font-mono text-xs">
            <dt className={LABEL}>from</dt>
            <dd>
              {impostor ? <span className="text-muted-foreground">claims to be </span> : null}
              <span className="font-bold">this node</span>
            </dd>

            {/* Below sm the text gets the full width, so the whole sentence
                stays readable while the visitor edits it. */}
            <dt className={cn(LABEL, "col-span-2 sm:col-span-1")}>
              {state.stage === "tamper" ? <label htmlFor={inputId}>says</label> : "says"}
            </dt>
            <dd className="col-span-2 -mt-1.5 min-w-0 sm:col-span-1 sm:mt-0">
              {state.stage === "tamper" ? (
                <div className="flex flex-col gap-2">
                  <input
                    id={inputId}
                    type="text"
                    value={state.text}
                    maxLength={TEXT_MAX}
                    spellCheck={false}
                    autoComplete="off"
                    aria-describedby={hintId}
                    onChange={(e) => dispatch({ type: "edit", text: e.target.value })}
                    className="min-h-11 w-full min-w-0 rounded-none border border-foreground bg-card px-3 font-mono text-base text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:min-h-9 sm:text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span id={hintId} className="text-[10px] text-muted-foreground">
                      change any letter on its way to the peer
                    </span>
                    <button
                      type="button"
                      className={SMALL_BUTTON}
                      aria-disabled={verdict.kind === "reject-tampered" ? undefined : true}
                      onClick={() => dispatch({ type: "restore" })}
                    >
                      restore
                    </button>
                  </div>
                </div>
              ) : (
                <span className="break-words">“{heard.text}”</span>
              )}
            </dd>

            <dt className={LABEL}>key</dt>
            <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <KeyBars
                keyId={heard.key}
                label={heard.key === NODE_KEY ? "key: the node's own key" : "key: a different key"}
              />
              <span className="text-[10px] text-muted-foreground">{keyNote(scene)}</span>
            </dd>

            <dt className={LABEL}>demo checksum</dt>
            <dd className="flex flex-wrap gap-x-2 text-[10px] tracking-widest">
              <span>
                <span className="text-muted-foreground">sealed </span>
                {heard.checksum}
              </span>
              <span>
                <span className="text-muted-foreground">now </span>
                {recomputed}
              </span>
              <span className="font-bold">{recomputed === heard.checksum ? "match" : "no match"}</span>
            </dd>

            <dt className={LABEL}>seal</dt>
            <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* Remounts when the seal turns broken, replaying the one-shot glitch. */}
              <Seal key={`seal-${state.breakCount}`} state={verdict.seal} />
              <span className="text-[10px] text-muted-foreground">{SEAL_NOTE[verdict.seal]}</span>
            </dd>
          </dl>
        ) : (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {state.stage === "install" ? "no peer has heard this node yet · press 2 ANNOUNCE" : "nothing heard yet"}
          </p>
        )}
      </div>

      <div className="px-4 py-3">
        <p className={LABEL}>verdict</p>
        {verdict ? (
          <div className="mt-2 flex flex-col items-start gap-2">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest",
                verdict.accepted ? "border border-foreground" : "bg-foreground text-background",
              )}
            >
              {verdict.accepted ? "accepted" : "rejected"}
            </span>
            <p className="font-mono text-xs text-muted-foreground">{verdictReason(verdict)}</p>
          </div>
        ) : (
          <p className="mt-2 font-mono text-xs text-muted-foreground">waiting for an announcement</p>
        )}
      </div>
    </div>
  )
}
