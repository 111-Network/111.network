import { useId, useState, type KeyboardEvent, type ReactNode } from "react"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { getLayer } from "@/lib/layers"
import type { DeviceId } from "@/lib/devices"
import { cn } from "@/lib/utils"
import {
  REJECTED_LINE,
  changesPendingLine,
  checkRows,
  currentFix,
  faultById,
  healMode,
  healPhase,
  prBadge,
  talkLog,
  type CheckResult,
  type HealState,
} from "./model"

const TABS = [
  { id: "talk", label: "TALK" },
  { id: "changes", label: "CHANGES" },
  { id: "checks", label: "CHECKS" },
] as const

type TabId = (typeof TABS)[number]["id"]

/** Props of PullRequest. */
export interface PullRequestProps {
  state: HealState
  device: DeviceId
  /** The four layer specs, rendered on the server, shown as the request's sidebar. */
  specs: ReactNode
}

/** Right column: V6's tabbed shell as a pull request (TALK / CHANGES / CHECKS). No browser chrome. */
export function PullRequest({ state, device, specs }: PullRequestProps) {
  const [tab, setTab] = useState<TabId>("talk")
  const base = useId()
  const titleId = `${base}-title`
  const tabId = (id: TabId) => `${base}-tab-${id}`
  const panelId = (id: TabId) => `${base}-panel-${id}`

  const mode = healMode(device)
  const phase = healPhase(state)
  const fault = state.fault === null ? null : faultById(state.fault)
  const title =
    mode === "none" ? "No pull request: a radio relay runs no agent" : fault === null ? "No pull request yet" : fault.title
  const strong = phase === "ready" || phase === "done" || (phase === "rail" && state.passed >= 4)

  function select(index: number) {
    const next = TABS[(index + TABS.length) % TABS.length]
    setTab(next.id)
    document.getElementById(tabId(next.id))?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: TABS.length - 1,
    }
    const target = moves[event.key]
    if (target === undefined) return
    event.preventDefault()
    select(target)
  }

  return (
    <Panel role="group" aria-labelledby={titleId} className="flex min-w-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pull request</p>
          <SimulationChip className="shrink-0" />
        </div>
        <h3 id={titleId} className="mt-2 font-mono text-sm font-bold text-foreground md:text-base">
          {title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px]">
          <span
            className={cn(
              "border px-2 py-0.5 uppercase tracking-widest",
              strong ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
            )}
          >
            {mode === "none" ? "NO AGENT" : prBadge(state)}
          </span>
          {fault !== null && (
            <span className="text-muted-foreground">
              {`from this node's agent · layer ${getLayer(fault.layer).ghost} ${getLayer(fault.layer).navLabel.toLowerCase()}`}
            </span>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="pull request" className="flex overflow-x-auto border-b border-border">
        {TABS.map((t, i) => {
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              id={tabId(t.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 border-r border-border px-4 py-2 font-mono text-xs transition-colors duration-200 motion-reduce:transition-none sm:min-h-10 sm:px-5",
                "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none focus-visible:ring-inset",
                selected
                  ? "bg-foreground text-background focus-visible:ring-background"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <span aria-hidden="true" className="text-[10px] opacity-60">
                {`0${i + 1}`}
              </span>
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
      </div>

      <div className="grid flex-1 xl:grid-cols-3">
        <div className="min-w-0 border-b border-border xl:col-span-2 xl:border-r xl:border-b-0">
          {TABS.map((t) => (
            <div
              key={t.id}
              role="tabpanel"
              id={panelId(t.id)}
              aria-labelledby={tabId(t.id)}
              hidden={tab !== t.id}
              tabIndex={0}
              className="min-h-72 p-4 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none focus-visible:ring-inset"
            >
              {t.id === "talk" ? (
                <TalkPane state={state} device={device} />
              ) : t.id === "changes" ? (
                <ChangesPane state={state} device={device} />
              ) : (
                <ChecksPane state={state} device={device} />
              )}
            </div>
          ))}
        </div>
        <div className="p-4">{specs}</div>
      </div>
    </Panel>
  )
}

function Empty({ device, children }: { device: DeviceId; children: ReactNode }) {
  return (
    <p className="font-mono text-xs leading-relaxed text-muted-foreground">
      {healMode(device) === "none" ? "Nothing here: a radio relay runs no agent, so it opens no requests." : children}
    </p>
  )
}

function TalkPane({ state, device }: { state: HealState; device: DeviceId }) {
  const entries = talkLog(state, device)
  if (healMode(device) === "none" || entries.length === 0) {
    return <Empty device={device}>No pull request yet. Break a layer and the agent opens one here.</Empty>
  }
  return (
    <ol aria-label="request log" className="flex flex-col gap-2 border-l border-border pl-3 font-mono text-xs leading-relaxed">
      {entries.map((entry, i) => (
        <li key={`${i}-${entry.who}`} className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[8.5rem_1fr] sm:gap-3">
          <span className="text-muted-foreground">{entry.who}</span>
          <span className="text-foreground">{entry.text}</span>
        </li>
      ))}
    </ol>
  )
}

function ChangesPane({ state, device }: { state: HealState; device: DeviceId }) {
  const fix = currentFix(state)
  if (healMode(device) === "none" || state.fault === null) {
    return <Empty device={device}>Nothing to change: every layer is healthy.</Empty>
  }
  if (fix === null || state.agentStep < 2) {
    return <Empty device={device}>{changesPendingLine(state, device)}</Empty>
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {state.fix === "bad" ? "the bad fix, in plain words" : "the fix, in plain words"}
      </p>
      <ul aria-label="changes" className="flex flex-col gap-1 font-mono text-xs leading-relaxed">
        {fix.diff.map((line) => (
          <li key={`${line.op}-${line.text}`} className="flex gap-2">
            <span aria-hidden="true" className="w-3 shrink-0 text-muted-foreground">
              {line.op === "add" ? "+" : line.op === "remove" ? "-" : " "}
            </span>
            {line.op === "add" ? (
              <ins className="bg-foreground px-1 text-background no-underline">
                <span className="sr-only">added: </span>
                {line.text}
              </ins>
            ) : line.op === "remove" ? (
              <del className="text-muted-foreground line-through">
                <span className="sr-only">removed: </span>
                {line.text}
              </del>
            ) : (
              <span className="text-muted-foreground">
                <span className="sr-only">unchanged: </span>
                {line.text}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const RESULT_WORD: Record<CheckResult, string> = { waiting: "WAITING", pass: "PASS", fail: "FAIL" }

function ChecksPane({ state, device }: { state: HealState; device: DeviceId }) {
  if (healMode(device) === "none" || state.fault === null) {
    return <Empty device={device}>No checks yet: nothing is broken.</Empty>
  }
  const rows = checkRows(state)
  const phase = healPhase(state)
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="checks" className="grid gap-px border border-border bg-border sm:grid-cols-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              "flex flex-col gap-2 bg-card p-3 font-mono",
              row.result === "fail" && "outline outline-1 -outline-offset-1 outline-foreground",
            )}
          >
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
              {row.result === "fail" ? (
                <span aria-hidden="true" className="w-2 text-center leading-none text-foreground">
                  ×
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 w-2 shrink-0",
                    row.result === "pass" ? "bg-foreground" : "border border-muted-foreground",
                  )}
                />
              )}
              <span className={row.result === "waiting" ? "text-muted-foreground" : "font-bold text-foreground"}>
                {RESULT_WORD[row.result]}
              </span>
            </span>
            <span className={cn("text-xs", row.result === "waiting" ? "text-muted-foreground" : "text-foreground")}>
              {row.label}
            </span>
          </li>
        ))}
      </ul>
      <p className="font-mono text-xs leading-relaxed text-foreground">
        {phase === "working"
          ? "The sandbox test runs once the fix is built."
          : phase === "rejected"
            ? REJECTED_LINE
            : phase === "ready"
              ? "Every check passes. Nothing changes on your node until you approve it on the gate rail."
              : phase === "dismissed"
                ? "Dismissed: nothing was applied."
                : "Every check passed in the sandbox before anything left it."}
      </p>
    </div>
  )
}
