// The ONE place that combines core + the twelve view slices: the state type, the action union,
// the initial state and the reducer. Written once by the engine task; view tasks edit only their
// own slices/<name>.ts and never this file.
import { initialCore, reduceCore, type CoreAction, type CoreInit, type CoreState } from "../core"
import type { NeedItem, ReduceCtx, SliceCtx } from "../types"
import type { World } from "../world"
import { initialAgent, needsAgent, reduceAgent, type AgentAction, type AgentState } from "./agent"
import { initialBridge, needsBridge, reduceBridge, type BridgeAction, type BridgeState } from "./bridge"
import { initialDevices, needsDevices, reduceDevices, type DevicesAction, type DevicesState } from "./devices"
import { initialGateway, needsGateway, reduceGateway, type GatewayAction, type GatewayState } from "./gateway"
import { initialKb, needsKb, reduceKb, type KbAction, type KbState } from "./kb"
import { initialMessages, needsMessages, reduceMessages, type MessagesAction, type MessagesState } from "./messages"
import { initialNearby, needsNearby, reduceNearby, type NearbyAction, type NearbyState } from "./nearby"
import { initialOverview, needsOverview, reduceOverview, type OverviewAction, type OverviewState } from "./overview"
import { initialRepairs, needsRepairs, reduceRepairs, type RepairsAction, type RepairsState } from "./repairs"
import { initialServices, needsServices, reduceServices, type ServicesAction, type ServicesState } from "./services"
import { initialSettings, needsSettings, reduceSettings, type SettingsAction, type SettingsState } from "./settings"
import { initialStorage, needsStorage, reduceStorage, type StorageAction, type StorageState } from "./storage"

/** The view slices, in the order their reducers run (after core). */
export const SLICE_NAMES = ["agent", "overview", "devices", "nearby", "gateway", "messages", "kb", "services", "bridge", "storage", "repairs", "settings"] as const

export type SliceName = (typeof SLICE_NAMES)[number]

export interface DemoState {
  core: CoreState
  agent: AgentState
  overview: OverviewState
  devices: DevicesState
  nearby: NearbyState
  gateway: GatewayState
  messages: MessagesState
  kb: KbState
  services: ServicesState
  bridge: BridgeState
  storage: StorageState
  repairs: RepairsState
  settings: SettingsState
}

/** Every action of the demo: core's catalog plus each slice's own "<name>/…" actions. */
export type DemoAction =
  | CoreAction
  | AgentAction
  | OverviewAction
  | DevicesAction
  | NearbyAction
  | GatewayAction
  | MessagesAction
  | KbAction
  | ServicesAction
  | BridgeAction
  | StorageAction
  | RepairsAction
  | SettingsAction

/** What every slice module provides. A stub may declare fewer parameters; they are always passed. */
export interface SliceModule<S> {
  initial(world: World): S
  reduce(state: S, action: DemoAction, ctx: SliceCtx): S
  needs(state: S, core: CoreState): readonly NeedItem[]
}

type SliceRegistry = { [K in SliceName]: SliceModule<DemoState[K]> }

const SLICES: SliceRegistry = {
  agent: { initial: initialAgent, reduce: reduceAgent, needs: needsAgent },
  overview: { initial: initialOverview, reduce: reduceOverview, needs: needsOverview },
  devices: { initial: initialDevices, reduce: reduceDevices, needs: needsDevices },
  nearby: { initial: initialNearby, reduce: reduceNearby, needs: needsNearby },
  gateway: { initial: initialGateway, reduce: reduceGateway, needs: needsGateway },
  messages: { initial: initialMessages, reduce: reduceMessages, needs: needsMessages },
  kb: { initial: initialKb, reduce: reduceKb, needs: needsKb },
  services: { initial: initialServices, reduce: reduceServices, needs: needsServices },
  bridge: { initial: initialBridge, reduce: reduceBridge, needs: needsBridge },
  storage: { initial: initialStorage, reduce: reduceStorage, needs: needsStorage },
  repairs: { initial: initialRepairs, reduce: reduceRepairs, needs: needsRepairs },
  settings: { initial: initialSettings, reduce: reduceSettings, needs: needsSettings },
}

export function initialDemoState(world: World, init: CoreInit): DemoState {
  return {
    core: initialCore(world, init),
    agent: SLICES.agent.initial(world),
    overview: SLICES.overview.initial(world),
    devices: SLICES.devices.initial(world),
    nearby: SLICES.nearby.initial(world),
    gateway: SLICES.gateway.initial(world),
    messages: SLICES.messages.initial(world),
    kb: SLICES.kb.initial(world),
    services: SLICES.services.initial(world),
    bridge: SLICES.bridge.initial(world),
    storage: SLICES.storage.initial(world),
    repairs: SLICES.repairs.initial(world),
    settings: SLICES.settings.initial(world),
  }
}

/**
 * One action through core, then through every slice (each sees the core state AFTER core reduced
 * it). Returns `state` itself when nothing changed, so subscribers are not woken for nothing.
 */
export function reduceDemo(state: DemoState, action: DemoAction, ctx: ReduceCtx): DemoState {
  const core = reduceCore(state.core, action, ctx)
  const sctx: SliceCtx = {
    world: ctx.world,
    now: ctx.now,
    prev: ctx.prev,
    core,
    schedule: ctx.schedule,
    cancel: ctx.cancel,
    dispatch: ctx.dispatch,
    emit: ctx.emit,
    rng: ctx.rng,
  }
  const next: DemoState = {
    core,
    agent: SLICES.agent.reduce(state.agent, action, sctx),
    overview: SLICES.overview.reduce(state.overview, action, sctx),
    devices: SLICES.devices.reduce(state.devices, action, sctx),
    nearby: SLICES.nearby.reduce(state.nearby, action, sctx),
    gateway: SLICES.gateway.reduce(state.gateway, action, sctx),
    messages: SLICES.messages.reduce(state.messages, action, sctx),
    kb: SLICES.kb.reduce(state.kb, action, sctx),
    services: SLICES.services.reduce(state.services, action, sctx),
    bridge: SLICES.bridge.reduce(state.bridge, action, sctx),
    storage: SLICES.storage.reduce(state.storage, action, sctx),
    repairs: SLICES.repairs.reduce(state.repairs, action, sctx),
    settings: SLICES.settings.reduce(state.settings, action, sctx),
  }
  const keys = Object.keys(next) as (keyof DemoState)[]
  return keys.every((k) => next[k] === state[k]) ? state : next
}

/** Every slice's "needs you" rows, in slice order. */
export function sliceNeeds(state: DemoState): NeedItem[] {
  return [
    ...SLICES.agent.needs(state.agent, state.core),
    ...SLICES.overview.needs(state.overview, state.core),
    ...SLICES.devices.needs(state.devices, state.core),
    ...SLICES.nearby.needs(state.nearby, state.core),
    ...SLICES.gateway.needs(state.gateway, state.core),
    ...SLICES.messages.needs(state.messages, state.core),
    ...SLICES.kb.needs(state.kb, state.core),
    ...SLICES.services.needs(state.services, state.core),
    ...SLICES.bridge.needs(state.bridge, state.core),
    ...SLICES.storage.needs(state.storage, state.core),
    ...SLICES.repairs.needs(state.repairs, state.core),
    ...SLICES.settings.needs(state.settings, state.core),
  ]
}
