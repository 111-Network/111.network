import { useCallback, useEffect, useState, type RefObject } from "react"
import { usePageVisible } from "@/hooks/use-page-visible"

// One shared helper gates every JS-driven loop (plan §7 motion budget):
// a loop may run only while its element is on screen AND the tab is visible.
// Observers are pooled per (rootMargin, threshold), so many sections share one.
//
// CLIENT COMPONENTS ONLY (React hooks; observeInView touches the DOM).

type Callback = (intersecting: boolean) => void

interface Pool {
  observer: IntersectionObserver
  callbacks: Map<Element, Set<Callback>>
  /** Last isIntersecting seen per element, replayed to callbacks that join later. */
  last: Map<Element, boolean>
}

const pools = new Map<string, Pool>()

function getPool(rootMargin: string, threshold: number): Pool {
  const key = `${rootMargin}|${threshold}`
  let pool = pools.get(key)
  if (!pool) {
    const callbacks = new Map<Element, Set<Callback>>()
    const last = new Map<Element, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const set = callbacks.get(entry.target)
          if (!set) continue
          last.set(entry.target, entry.isIntersecting)
          for (const cb of set) cb(entry.isIntersecting)
        }
      },
      { rootMargin, threshold },
    )
    pool = { observer, callbacks, last }
    pools.set(key, pool)
  }
  return pool
}

/** Options for observeInView / useInViewPlay / useInViewPlayRef. */
export interface InViewPlayOptions {
  /** IntersectionObserver rootMargin, e.g. "200px 0px" to start a little early. Default "0px". */
  rootMargin?: string
  /** IntersectionObserver threshold. Default 0. */
  threshold?: number
}

/**
 * Observe `el`; `cb` gets the current state (asynchronously, like a real
 * observer) and then every intersection change. Several callbacks may share
 * one element: one that joins later still receives the element's last known
 * state. Returns the cleanup.
 */
export function observeInView(el: Element, cb: Callback, { rootMargin = "0px", threshold = 0 }: InViewPlayOptions = {}): () => void {
  if (typeof IntersectionObserver === "undefined") {
    // Very old browser: treat as always in view, asynchronously like a real observer.
    const id = setTimeout(() => cb(true), 0)
    return () => clearTimeout(id)
  }
  const pool = getPool(rootMargin, threshold)
  let set = pool.callbacks.get(el)
  let active = true
  if (!set) {
    set = new Set()
    pool.callbacks.set(el, set)
    set.add(cb)
    // The observer delivers the initial entry to every callback in the set.
    pool.observer.observe(el)
  } else {
    set.add(cb)
    // The element is already observed, so no initial entry is coming: replay the
    // last one. If it has not arrived yet, the pending first entry reaches cb too.
    queueMicrotask(() => {
      const known = pool.last.get(el)
      if (active && known !== undefined) cb(known)
    })
  }
  return () => {
    active = false
    const current = pool.callbacks.get(el)
    if (!current) return
    current.delete(cb)
    if (current.size === 0) {
      pool.callbacks.delete(el)
      pool.last.delete(el)
      pool.observer.unobserve(el)
    }
  }
}

interface Seen {
  el: Element | null
  inView: boolean
}

const NOTHING_SEEN: Seen = { el: null, inView: false }

/**
 * True while `ref`'s element intersects the viewport AND the page is visible.
 * False on the server and until the first observation. Reduced motion is NOT
 * included: combine it yourself.
 *
 * The element is read once per mount (and when the options change), so put the
 * ref on an ALWAYS-MOUNTED wrapper (the section, the window frame). If the
 * observed element is swapped or rendered conditionally, use useInViewPlayRef.
 */
export function useInViewPlay(ref: RefObject<Element | null>, { rootMargin = "0px", threshold = 0 }: InViewPlayOptions = {}): boolean {
  const [seen, setSeen] = useState<Seen>(NOTHING_SEEN)
  const visible = usePageVisible()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return observeInView(el, (inView) => setSeen({ el, inView }), { rootMargin, threshold })
  }, [ref, rootMargin, threshold])

  return seen.inView && visible
}

/**
 * Callback-ref form of useInViewPlay, for an element that mounts later, is
 * swapped, or is rendered conditionally: `const [ref, play] = useInViewPlayRef()`
 * then `<div ref={ref}>`. Re-observes whenever the element changes and reads
 * false while no element is attached.
 */
export function useInViewPlayRef<T extends Element = HTMLElement>({ rootMargin = "0px", threshold = 0 }: InViewPlayOptions = {}): [
  (node: T | null) => void,
  boolean,
] {
  const [node, setNode] = useState<T | null>(null)
  const [seen, setSeen] = useState<Seen>(NOTHING_SEEN)
  const visible = usePageVisible()
  const ref = useCallback((next: T | null) => setNode(next), [])

  useEffect(() => {
    if (!node) return
    return observeInView(node, (inView) => setSeen({ el: node, inView }), { rootMargin, threshold })
  }, [node, rootMargin, threshold])

  // A reading from a previous element never leaks onto the next one.
  const inView = node !== null && seen.el === node && seen.inView
  return [ref, inView && visible]
}
