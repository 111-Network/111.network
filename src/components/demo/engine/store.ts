// The demo store (plan §6.5 "Store"): a FACTORY, never a singleton, read through
// useSyncExternalStore (engine/react.tsx). Plain TS: no React, no Next. Safe to create during
// render or on the server: it touches window only in start(), navigate() and URL sync.
//
// router "url"   (/demo): parses location.hash on start() and on hashchange + popstate; every route
//                change in state is written back with history.pushState (App Router's pushState does
//                not fire hashchange, so the store applies the route itself). It only ever acts while
//                the page is still the one it started on: Next handles a Back to "/" inside a
//                transition, so /demo is still mounted when that popstate arrives, and the home
//                page's "#layer-4" must never be read as a route or rewritten.
// router "memory" (the L4 teaser): never touches location; hrefFor() points at the full /demo.
import { DEMO_PATH } from "@/lib/site"
import { createRng } from "@/lib/prng"
import type { DemoAction, DemoState } from "./slices"
import { initialDemoState, reduceDemo } from "./slices"
import { DEFAULT_PATH, formatRoute, hashFor, parsePath, pathFromHash } from "./router"
import { createScheduler, realTimeDriver, type Scheduler, type SchedulerDriver } from "./scheduler"
import type { LayoutPref, ReduceCtx, RouterKind, ScheduleOptions } from "./types"
import type { World } from "./world"

export interface DemoStoreOptions {
  /** Default "url". */
  router?: RouterKind
  /** Default "auto". */
  layout?: LayoutPref
  /** Memory router: the first route (default "/overview"). The url router always starts from the hash. */
  initialPath?: string
  /** Read/write mode and rail in localStorage (after mount, in an effect). Default: router === "url". */
  persist?: boolean
  /**
   * Scheduler driver. Default: the real-time driver, created in start(). null = manual time
   * (tests call store.scheduler.advance(ms)).
   */
  driver?: SchedulerDriver | null
  /** Where hrefFor() points for the memory router. Default DEMO_PATH ("/demo"). */
  demoPath?: string
}

export interface ResolvedStoreOptions {
  router: RouterKind
  layout: LayoutPref
  initialPath: string
  persist: boolean
  demoPath: string
}

export interface DemoStore {
  readonly world: World
  readonly options: Readonly<ResolvedStoreOptions>
  /** The pausable virtual clock. View code may schedule UI-only steps on it (returns a cancel). */
  readonly scheduler: Scheduler
  getSnapshot(): DemoState
  /** Constant: the initial state with `core.route` null (the hash cannot be read on the server). */
  getServerSnapshot(): DemoState
  subscribe(listener: () => void): () => void
  dispatch(action: DemoAction): void
  /** Go to a route string ("/devices", "/overview#needs-you"). The url router pushes a history entry. */
  navigate(path: string, opts?: { replace?: boolean }): void
  /** The href for a route string: "#/devices" (url) or "/demo#/devices" (memory). */
  hrefFor(path: string): string
  /** Dispatch `task` (an action) or call it (a function) after `delayMs` of virtual time. Returns a cancel. */
  schedule(delayMs: number, task: DemoAction | (() => void), opts?: ScheduleOptions): () => void
  /** Attach listeners and the clock. Idempotent; DemoStoreProvider calls it in an effect. */
  start(): void
  /** Detach listeners and the clock (pending steps are kept for the next start). */
  stop(): void
  isStarted(): boolean
}

/** A drain that keeps producing follow-ups this long is a reducer loop. */
const MAX_ACTIONS_PER_DISPATCH = 1000

export function createDemoStore(world: World, options: DemoStoreOptions = {}): DemoStore {
  const opts: ResolvedStoreOptions = {
    router: options.router ?? "url",
    layout: options.layout ?? "auto",
    initialPath: options.initialPath ?? DEFAULT_PATH,
    persist: options.persist ?? (options.router ?? "url") === "url",
    demoPath: options.demoPath ?? DEMO_PATH,
  }
  const driverOption = options.driver
  const scheduler = createScheduler()

  const serverSnapshot: DemoState = initialDemoState(world, { layout: opts.layout, route: null })
  let state: DemoState =
    opts.router === "memory" ? initialDemoState(world, { layout: opts.layout, route: parsePath(opts.initialPath) }) : serverSnapshot

  const listeners = new Set<() => void>()
  const queue: DemoAction[] = []
  let draining = false
  let started = false
  let replaceNext = false
  let detachUrl: (() => void) | null = null
  /** The pathname the url router started on ("/demo"); it ignores the URL whenever it differs. */
  let routerPath: string | null = null

  function notify(): void {
    for (const l of [...listeners]) l()
  }

  /**
   * One action through reduceDemo. The context only RECORDS effects; they are applied once the
   * reducer has returned (schedule/cancel in call order, then the follow-ups queued in call order),
   * so a reducer that throws leaves no timer armed and no follow-up queued for a state that never
   * committed.
   */
  function runOne(action: DemoAction): void {
    const prev = state
    const now = scheduler.now()
    const effects: (() => void)[] = []
    const follow: DemoAction[] = []
    const ctx: ReduceCtx = {
      world,
      now,
      prev,
      schedule: (delayMs, next, o) => {
        effects.push(() => {
          scheduler.schedule(delayMs, () => dispatch(next), { key: o?.key, label: next.type })
        })
      },
      cancel: (key) => {
        effects.push(() => scheduler.cancel(key))
      },
      dispatch: (next) => {
        follow.push(next)
      },
      emit: (cause, o) => {
        follow.push({ type: "core/emitEvent", cause, text: o?.text, ref: o?.ref ?? null })
      },
      rng: (seed) => createRng(`${world.seed}|${seed}|${now}`),
    }
    state = reduceDemo(prev, action, ctx)
    if (action.type === "core/navigate" && action.replace) replaceNext = true
    for (const apply of effects) apply()
    queue.push(...follow)
  }

  function dispatch(action: DemoAction): void {
    queue.push(action)
    if (draining) return
    draining = true
    const before = state
    let count = 0
    try {
      while (queue.length > 0) {
        if (++count > MAX_ACTIONS_PER_DISPATCH) throw new Error("demo store: too many follow-up actions (a reducer loop?)")
        runOne(queue.shift() as DemoAction)
      }
    } catch (err) {
      // Nothing queued by this drain may run on the next, unrelated dispatch.
      queue.length = 0
      throw err
    } finally {
      draining = false
      // What did commit before a throw is still published.
      syncUrl()
      if (state !== before) notify()
    }
  }

  // ------------------------------------------------------------------------------- url router

  /** Is the browser still on the page the url router started on? */
  function onRouterPage(): boolean {
    return routerPath !== null && window.location.pathname === routerPath
  }

  function syncUrl(): void {
    const replace = replaceNext
    replaceNext = false
    if (opts.router !== "url" || !started || typeof window === "undefined" || !onRouterPage()) return
    const route = state.core.route
    if (!route) return
    const hash = hashFor(formatRoute(route))
    if (window.location.hash === hash) return
    const url = `${window.location.pathname}${window.location.search}${hash}`
    if (replace) window.history.replaceState(null, "", url)
    else window.history.pushState(null, "", url)
  }

  function attachUrl(): () => void {
    routerPath = window.location.pathname
    // Normalise in place (an empty hash becomes "#/overview" without a new history entry). A
    // hashchange or popstate that lands on another page (Back to the home page) is not ours.
    const onUrl = () => {
      if (!onRouterPage()) return
      dispatch({ type: "core/navigate", path: pathFromHash(window.location.hash), replace: true })
    }
    window.addEventListener("hashchange", onUrl)
    window.addEventListener("popstate", onUrl)
    onUrl()
    return () => {
      window.removeEventListener("hashchange", onUrl)
      window.removeEventListener("popstate", onUrl)
      routerPath = null
    }
  }

  // ------------------------------------------------------------------------------- public API

  const store: DemoStore = {
    world,
    options: opts,
    scheduler,
    getSnapshot: () => state,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispatch,
    navigate(path, o) {
      dispatch({ type: "core/navigate", path, replace: o?.replace })
    },
    hrefFor(path) {
      return opts.router === "url" ? hashFor(path) : `${opts.demoPath}${hashFor(path)}`
    },
    schedule(delayMs, task, o) {
      if (typeof task === "function") return scheduler.schedule(delayMs, task, { key: o?.key })
      return scheduler.schedule(delayMs, () => dispatch(task), { key: o?.key, label: task.type })
    },
    start() {
      if (started) return
      started = true
      if (opts.router === "url" && typeof window !== "undefined") detachUrl = attachUrl()
      if (driverOption !== null) scheduler.attach(driverOption ?? realTimeDriver())
    },
    stop() {
      if (!started) return
      started = false
      detachUrl?.()
      detachUrl = null
      scheduler.detach()
    },
    isStarted: () => started,
  }
  return store
}
