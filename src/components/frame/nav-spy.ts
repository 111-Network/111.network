import { useSyncExternalStore } from "react"
import { LAYERS, layerById, type LayerNumber } from "@/lib/layers"
import { SPY_ROOT_MARGIN, pickActive } from "./nav-model"

// Scroll-spy for the nav (plan §4.1): ONE IntersectionObserver over the ten
// sections, shared by the desktop rail, the readouts and the mobile sheet.
// It watches a thin band at the reading line, so no offsetTop reads, no scroll
// handler and no timers. Started by the first subscriber, stopped by the last.
//
// CLIENT COMPONENTS ONLY (useSyncExternalStore; subscribing touches the DOM).

type Listener = () => void

let active: LayerNumber | null = null
const listeners = new Set<Listener>()
let stop: (() => void) | null = null

function setActive(next: LayerNumber | null): void {
  if (next === active) return
  active = next
  for (const listener of listeners) listener()
}

function start(): () => void {
  if (typeof IntersectionObserver === "undefined" || typeof document === "undefined") return () => {}
  const inBand = new Set<number>()
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const layer = layerById(entry.target.id)
        if (!layer) continue
        if (entry.isIntersecting) inBand.add(layer.n)
        else inBand.delete(layer.n)
      }
      setActive(pickActive(inBand))
    },
    { rootMargin: SPY_ROOT_MARGIN, threshold: 0 },
  )
  for (const layer of LAYERS) {
    const el = document.getElementById(layer.id)
    if (el) observer.observe(el)
  }
  return () => observer.disconnect()
}

/** Subscribe to active-layer changes; the first subscriber starts the observer. Returns the unsubscribe. */
export function subscribeActiveLayer(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1) stop = start()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stop?.()
      stop = null
      active = null
    }
  }
}

/** The active layer right now (null above Layer 0, below Layer 9, or before the first observation). */
export function getActiveLayer(): LayerNumber | null {
  return active
}

function getServerSnapshot(): LayerNumber | null {
  return null
}

/** The layer whose section crosses the reading line; null on the server and during hydration. */
export function useActiveLayer(): LayerNumber | null {
  return useSyncExternalStore(subscribeActiveLayer, getActiveLayer, getServerSnapshot)
}
