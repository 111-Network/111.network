"use client"

// React bindings of the demo store (plan §6.5). CLIENT ONLY. The store itself is plain TS
// (engine/store.ts); this file wires it to useSyncExternalStore, starts and stops it with the
// provider, restores mode and rail from localStorage after mount (never in render or a useState
// initialiser), and pauses the virtual clock while the tab is hidden or the shell is offscreen.
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react"
import { useInViewPlayRef } from "@/hooks/use-in-view-play"
import { needsAdvanced } from "./core"
import type { DemoRoute } from "./router"
import type { DemoAction, DemoState } from "./slices"
import { createDemoStore, type DemoStore, type DemoStoreOptions } from "./store"
import type { UiMode } from "./types"
import type { World } from "./world"

const DemoStoreContext = createContext<DemoStore | null>(null)

export const MODE_STORAGE_KEY = "111.demo.mode"
export const RAIL_STORAGE_KEY = "111.demo.rail"

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null // storage blocked: server defaults stay
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* the choice still holds for this page load */
  }
}

const isMode = (v: string | null): v is UiMode => v === "simple" || v === "advanced"

/**
 * Create one store per mounted shell, once (never a module singleton). Options are read on the
 * first render only. Safe during SSR: the store touches window only after start().
 */
export function useDemoStoreInstance(world: World, options?: DemoStoreOptions): DemoStore {
  const [store] = useState(() => createDemoStore(world, options))
  return store
}

/**
 * Provides `store` to the shell and runs its lifecycle: start() after mount, stop() on unmount.
 * Render it from a client component (the store prop is not serialisable).
 */
export function DemoStoreProvider({ store, children }: { store: DemoStore; children: ReactNode }) {
  useEffect(() => {
    store.start()
    return () => store.stop()
  }, [store])

  // Mode and rail start from server defaults; the saved choice is applied after mount, then every change is saved.
  useEffect(() => {
    if (!store.options.persist) return
    const mode = readStored(MODE_STORAGE_KEY)
    const rail = readStored(RAIL_STORAGE_KEY)
    // A saved "simple" never overrides the switch a service page made (start() above already read the hash).
    if (isMode(mode) && !(mode === "simple" && needsAdvanced(store.getSnapshot().core.route))) store.dispatch({ type: "core/setMode", mode })
    if (rail === "1" || rail === "0") store.dispatch({ type: "core/setRail", collapsed: rail === "1" })
    let last = store.getSnapshot().core
    return store.subscribe(() => {
      const core = store.getSnapshot().core
      if (core.mode !== last.mode) writeStored(MODE_STORAGE_KEY, core.mode)
      if (core.railCollapsed !== last.railCollapsed) writeStored(RAIL_STORAGE_KEY, core.railCollapsed ? "1" : "0")
      last = core
    })
  }, [store])

  return <DemoStoreContext value={store}>{children}</DemoStoreContext>
}

/** The store of the nearest DemoStoreProvider (for navigate, hrefFor, schedule, world). */
export function useDemoStore(): DemoStore {
  const store = useContext(DemoStoreContext)
  if (!store) throw new Error("useDemoStore: render inside <DemoStoreProvider>")
  return store
}

/** Shallow equality for selectors that build a fresh array or object. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => Object.is(x, b[i]))
  }
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && Object.is(ra[k], rb[k]))
}

/**
 * A selector that returns its previous result for the same state object, or for an equal value,
 * so useSyncExternalStore sees a stable snapshot. Module scope: the cache is not render state.
 */
function cachedSelection<T>(selector: (s: DemoState) => T, isEqual: (a: T, b: T) => boolean): (s: DemoState) => T {
  let seen = false
  let lastState: DemoState | null = null
  let last = undefined as T
  return (s) => {
    if (seen && s === lastState) return last
    const next = selector(s)
    lastState = s
    if (seen && isEqual(last, next)) return last
    seen = true
    last = next
    return next
  }
}

/**
 * Read part of the demo state. Re-renders only when the selected value changes (Object.is, or
 * `isEqual`). On the server and during hydration it reads getServerSnapshot (route null).
 * Pass a MODULE-SCOPE selector (its identity keys the cache; an inline arrow rebuilds it every
 * render). Return existing references or primitives; for a derived array or object pass
 * shallowEqual or use a cached selector from engine/selectors.ts.
 */
export function useDemo<T>(selector: (s: DemoState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const store = useDemoStore()
  const select = useMemo(() => cachedSelection(selector, isEqual), [selector, isEqual])
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getSnapshot()),
    () => select(store.getServerSnapshot()),
  )
}

/**
 * useDemo for a selector that also reads the world, e.g. `useDemoWorld(ownDevice)`,
 * `useDemoWorld(meshNeighbours)`, `useDemoWorld(ownFactLines)`. Pass a module-scope function
 * (never an inline arrow); the engine's (s, world) selectors are cached and stable.
 */
export function useDemoWorld<T>(selector: (s: DemoState, world: World) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const store = useDemoStore()
  const bound = useMemo(() => (s: DemoState) => selector(s, store.world), [selector, store])
  return useDemo(bound, isEqual)
}

/** The store's dispatch (stable). */
export function useDispatch(): (action: DemoAction) => void {
  return useDemoStore().dispatch
}

/** The current route; null on the server and until the url router has read the hash. */
export function useRoute(): DemoRoute | null {
  return useDemo(selectRouteOf)
}

const selectRouteOf = (s: DemoState): DemoRoute | null => s.core.route

/** store.navigate (stable): `navigate("/devices")`, `navigate(PATHS.service("radio"))`. */
export function useNavigate(): DemoStore["navigate"] {
  return useDemoStore().navigate
}

/** The sample world (static). */
export function useWorld(): World {
  return useDemoStore().world
}

const AUTO_PAUSE = "view"

/**
 * Put the returned ref on the SHELL ROOT. The virtual clock then runs only while that element is
 * on screen and the tab is visible; scheduled demo steps wait otherwise (plan §6.5).
 */
export function useDemoAutoPause<T extends Element = HTMLElement>(): (node: T | null) => void {
  const store = useDemoStore()
  const [ref, play] = useInViewPlayRef<T>()
  useEffect(() => {
    const scheduler = store.scheduler
    if (play) scheduler.resume(AUTO_PAUSE)
    else scheduler.pause(AUTO_PAUSE)
    return () => scheduler.resume(AUTO_PAUSE)
  }, [store, play])
  return ref
}

export interface DemoLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** A route string: "/devices", PATHS.service("radio"), "/overview#needs-you". */
  to: string
  replace?: boolean
}

/**
 * An in-demo link: a real <a> (hash href on /demo, "/demo#/…" in the L4 teaser) whose plain
 * left click navigates through the store. Modified clicks keep the browser's behaviour.
 */
export function DemoLink({ to, replace, onClick, ...rest }: DemoLinkProps) {
  const store = useDemoStore()
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    store.navigate(to, { replace })
  }
  return <a {...rest} href={store.hrefFor(to)} onClick={handle} />
}
