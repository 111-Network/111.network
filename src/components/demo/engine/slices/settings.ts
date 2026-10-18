// Settings slice (#/settings, #/settings/l0 .. l9; plan §6.4 last three rows). Owned by the settings
// view task. Real sources: os/40-interface/ui/src/views/settings/{essentials,model}.ts (restart, update
// check, LAN sharing) and lib/api/mock/scenarios.ts `updating` (staged -> probation -> idle).
//
// What lives here, and only here:
// - the update check of Install & updates (L1): "[DEMO] check for updates" -> checking -> staged
//   (a newer signed version from the home hub, signature checked) -> probation (on trial) -> idle
//   with the new version (healthy), or -> reverting -> idle on the previous one (the rollback
//   branch, chosen with the "[DEMO] fail the next trial" switch). Every timed step goes through the
//   scheduler (key "settings:update"); with `instant` (reduced motion) the end state lands in the
//   same dispatch.
// - Restart node (Essentials): restarting -> back, through the scheduler (key "settings:restart").
//   A restart applies the "share on this network" choice, as the real LAN toggle needs one.
// The node name (Essentials and Identity · L2) is core state: the view dispatches core/renameNode.
import { SETTINGS_COPY, SETTINGS_NAME_MAX } from "../../copy/settings"
import { NO_NEEDS, type NeedItem, type SliceCtx } from "../types"
import type { DemoAction } from "./index"

/** Virtual durations of the timed steps (ms). */
export const SETTINGS_TIMING = {
  /** Asking the home hub for a newer version. */
  checkMs: 1400,
  /** Downloading it and checking its signature. */
  stageMs: 1800,
  /** The trial: the new version runs while the node checks its own health. */
  trialMs: 6000,
  /** Going back to the previous version after a failed trial. */
  revertMs: 1800,
  /** A restart, until the page has reconnected. */
  restartMs: 2400,
} as const

/** The newest update log lines kept. */
export const UPDATE_LOG_LIMIT = 20

export const UPDATE_KEY = "settings:update"
export const RESTART_KEY = "settings:restart"

/** Real `status.update.state`, minus "failed" (a failed trial reads as reverting, then rolled back). */
export type UpdatePhase = "idle" | "checking" | "staged" | "probation" | "reverting"

/** How the last finished check ended (real `last_result`, in words). */
export type UpdateResult = "up to date" | "updated" | "rolled back"

export interface UpdateLogLine {
  /** 1, 2, 3 … never reused (React key). */
  seq: number
  /** Virtual ms. */
  at: number
  text: string
}

export interface UpdateState {
  phase: UpdatePhase
  /** Checks started in this session; a scheduled step carries its run and is ignored once stale. */
  run: number
  /** Is the newer version the running one? false = the version installed at setup. */
  onNewer: boolean
  /** Virtual ms of the last finished check, or null. */
  lastCheck: number | null
  lastResult: UpdateResult | null
  /** "[DEMO] fail the next trial": consumed when a trial ends. */
  failNext: boolean
  /** The running trial failed (phase "reverting"). */
  failing: boolean
  /** Where the newer version came from on the last check that found one. */
  source: "hub" | "internet" | null
  /** Virtual ms of the last phase change. */
  since: number
  /** Newest last, at most UPDATE_LOG_LIMIT. */
  log: readonly UpdateLogLine[]
  logSeq: number
}

export interface RestartState {
  phase: "idle" | "restarting" | "back"
  /** Restarts requested in this session (the scheduled step carries it). */
  count: number
  since: number
}

/** "Share on this network" (real LAN sharing): the choice, and what the running node is bound to. */
export interface LanState {
  enabled: boolean
  /** What the node runs with now; it follows `enabled` only after a restart. */
  bound: boolean
}

export interface SettingsState {
  update: UpdateState
  restart: RestartState
  lan: LanState
}

export type SettingsAction =
  /** "[DEMO] check for updates". Ignored while a check runs or the node restarts. */
  | { type: "settings/updateCheck"; instant?: boolean }
  /** The next timed step of check `run` (scheduled by the slice itself). */
  | { type: "settings/updateStep"; run: number; instant?: boolean }
  /** "[DEMO] fail the next trial". Ignored while the node is already going back. */
  | { type: "settings/failNext"; fail: boolean }
  /** Restart node (after its two-step confirm). Ignored while restarting or while an update runs. */
  | { type: "settings/restart"; instant?: boolean }
  | { type: "settings/restarted"; count: number }
  /** "Share on this network". Applies on the next restart. */
  | { type: "settings/setLan"; enabled: boolean }

/** Sample history: the last check before the demo opened, as in the real fixture (3 h 12 min ago, up to date). */
export const OPENING_LAST_CHECK = -(3 * 60 + 12) * 60 * 1000

export function initialSettings(): SettingsState {
  return {
    update: {
      phase: "idle",
      run: 0,
      onNewer: false,
      lastCheck: OPENING_LAST_CHECK,
      lastResult: "up to date",
      failNext: false,
      failing: false,
      source: null,
      since: OPENING_LAST_CHECK,
      log: [],
      logSeq: 0,
    },
    restart: { phase: "idle", count: 0, since: 0 },
    lan: { enabled: false, bound: false },
  }
}

/** Is an update check running (any phase but idle)? */
export function updateBusy(u: Pick<UpdateState, "phase">): boolean {
  return u.phase !== "idle"
}

function withLog(u: UpdateState, at: number, ...texts: string[]): Pick<UpdateState, "log" | "logSeq"> {
  let seq = u.logSeq
  const lines = texts.map((text) => ({ seq: ++seq, at, text }))
  const all = [...u.log, ...lines]
  return { log: all.length > UPDATE_LOG_LIMIT ? all.slice(all.length - UPDATE_LOG_LIMIT) : all, logSeq: seq }
}

/** Through the scheduler after `ms`, or (instant, reduced motion) as a follow-up of this same dispatch. */
function later(ctx: SliceCtx, instant: boolean | undefined, ms: number, action: DemoAction, key: string): void {
  if (instant) {
    ctx.cancel(key)
    ctx.dispatch(action)
  } else {
    ctx.schedule(ms, action, { key })
  }
}

function sourceWords(source: UpdateState["source"]): string {
  return source === "internet" ? SETTINGS_COPY.update.source.internet : SETTINGS_COPY.update.source.hub
}

function stepUpdate(state: SettingsState, run: number, instant: boolean | undefined, ctx: SliceCtx): SettingsState {
  const u = state.update
  if (run !== u.run) return state
  const log = SETTINGS_COPY.update.log
  const next = (patch: Partial<UpdateState>, ...lines: string[]): SettingsState => ({
    ...state,
    update: { ...u, ...patch, since: ctx.now, ...withLog(u, ctx.now, ...lines) },
  })
  const step: DemoAction = { type: "settings/updateStep", run, instant }
  switch (u.phase) {
    case "checking": {
      if (u.onNewer) {
        ctx.emit("update-check", { text: SETTINGS_COPY.events.upToDate, ref: "settings" })
        return next({ phase: "idle", lastCheck: ctx.now, lastResult: "up to date" }, log.none)
      }
      // Offline-first: a newer version comes from the home hub over Wi-Fi, or over the internet while online.
      const source = ctx.core.internet === "connected" ? "internet" : "hub"
      ctx.emit("update-check", { text: SETTINGS_COPY.events.found, ref: "settings" })
      later(ctx, instant, SETTINGS_TIMING.stageMs, step, UPDATE_KEY)
      return next({ phase: "staged", lastCheck: ctx.now, source }, log.found(sourceWords(source)))
    }
    case "staged":
      if (!instant) ctx.emit("settings/trial", { text: SETTINGS_COPY.events.trial, ref: "settings" })
      later(ctx, instant, SETTINGS_TIMING.trialMs, step, UPDATE_KEY)
      return next({ phase: "probation" }, log.trial)
    case "probation":
      if (u.failNext) {
        later(ctx, instant, SETTINGS_TIMING.revertMs, step, UPDATE_KEY)
        return next({ phase: "reverting", failNext: false, failing: true }, log.failed, log.reverting)
      }
      ctx.emit("update-healthy", { ref: "settings" })
      return next({ phase: "idle", onNewer: true, lastResult: "updated" }, log.passed)
    case "reverting":
      ctx.emit("update-rolled-back", { ref: "settings" })
      return next({ phase: "idle", failing: false, lastResult: "rolled back" }, log.rolledBack)
    case "idle":
      return state
  }
}

export function reduceSettings(state: SettingsState, action: DemoAction, ctx: SliceCtx): SettingsState {
  switch (action.type) {
    case "settings/updateCheck": {
      const u = state.update
      if (updateBusy(u) || state.restart.phase === "restarting") return state
      const run = u.run + 1
      later(ctx, action.instant, SETTINGS_TIMING.checkMs, { type: "settings/updateStep", run, instant: action.instant }, UPDATE_KEY)
      return {
        ...state,
        update: { ...u, phase: "checking", run, failing: false, since: ctx.now, ...withLog(u, ctx.now, SETTINGS_COPY.update.log.checking) },
      }
    }
    case "settings/updateStep":
      return stepUpdate(state, action.run, action.instant, ctx)
    case "settings/failNext": {
      const u = state.update
      if (u.failNext === action.fail || u.phase === "reverting") return state
      return { ...state, update: { ...u, failNext: action.fail } }
    }
    case "settings/restart": {
      const r = state.restart
      if (r.phase === "restarting" || updateBusy(state.update)) return state
      const count = r.count + 1
      ctx.emit("settings/restart", { text: SETTINGS_COPY.events.restart(ctx.core.alias.slice(0, SETTINGS_NAME_MAX)), ref: "settings" })
      later(ctx, action.instant, SETTINGS_TIMING.restartMs, { type: "settings/restarted", count }, RESTART_KEY)
      return { ...state, restart: { phase: "restarting", count, since: ctx.now } }
    }
    case "settings/restarted": {
      const r = state.restart
      if (r.phase !== "restarting" || action.count !== r.count) return state
      ctx.emit("settings/restarted", { text: SETTINGS_COPY.events.restarted, ref: "settings" })
      const lan = state.lan.bound === state.lan.enabled ? state.lan : { ...state.lan, bound: state.lan.enabled }
      return { ...state, restart: { ...r, phase: "back", since: ctx.now }, lan }
    }
    case "settings/setLan":
      return state.lan.enabled === action.enabled ? state : { ...state, lan: { ...state.lan, enabled: action.enabled } }
    default:
      return state
  }
}

/** Settings adds nothing to "needs you" (the real attention rule counts proposals, errors and requests only). */
export function needsSettings(): readonly NeedItem[] {
  return NO_NEEDS
}
