// What the shell offers the views besides the store: the polite announcer and the main scroll area.
// Client tree only (rendered under DemoApp / DemoWindow, both "use client").
import { createContext, useContext, useEffect, useRef, type RefObject } from "react"
import { useDemo, useRoute } from "../engine/react"
import { clampHeading, type HeadingLevel } from "../ui/heading"
import { findWithin, scrollWithin } from "./scroll"
import { selectNavCount } from "./select"

export interface ShellContextValue {
  /** Id of the shell's main area (focus target of the skip button). */
  mainId: string
  /** The shell's main area: the one scroll container of the views. */
  mainRef: RefObject<HTMLElement | null>
  /** Queue one polite announcement (throttled to one per 2 s of demo time; the newest wins). */
  announce: (text: string) => void
  /**
   * The shell is embedded in another page (the Layer 4 window on the home page): no <main>, no skip
   * button, the sidebar nav is "Dashboard", and headings start at 3 under that section's h2.
   */
  embedded: boolean
  /** Level of a view's own title: 1 on /demo, 3 inside the L4 window. */
  headingBase: HeadingLevel
}

const ShellContext = createContext<ShellContextValue | null>(null)

export const ShellProvider = ShellContext

function useShell(): ShellContextValue {
  const value = useContext(ShellContext)
  if (!value) throw new Error("demo shell: render views inside <Shell>")
  return value
}

/**
 * The shell's polite announcer: `const announce = useAnnounce(); announce("Restarting Mesh link.")`.
 * Store events (every ctx.emit) and navigation are announced by the shell already; use this only for
 * view-local news that has no event (a copied label, a filter result count).
 */
export function useAnnounce(): (text: string) => void {
  return useShell().announce
}

/**
 * The heading level for a view: `useHeadingLevel()` for the view's own title (h1 on /demo, h3 in the
 * L4 window), `useHeadingLevel(1)` for its sections, `useHeadingLevel(2)` below those. Never write a
 * literal level in a view.
 */
export function useHeadingLevel(depth = 0): HeadingLevel {
  return clampHeading(useShell().headingBase + depth)
}

/** True inside the Layer 4 window on the home page (see ShellContextValue.embedded). */
export function useShellEmbedded(): boolean {
  return useShell().embedded
}

/** The shell's main area (a <main> on /demo, a labelled region in the L4 window), for a view that must scroll it. Read `.current` in effects or handlers only. */
export function useShellMain(): RefObject<HTMLElement | null> {
  return useShell().mainRef
}

/**
 * Put the returned ref on the element whose id is a route fragment ("/overview#needs-you"):
 * `const ref = useFragmentTarget<HTMLElement>("needs-you"); <section id="needs-you" ref={ref}>`.
 * When the route carries that fragment (on mount, and on every navigation to it), main scrolls so
 * the element sits at its top. The page itself never scrolls.
 */
export function useFragmentTarget<T extends HTMLElement>(fragment: string): RefObject<T | null> {
  const ref = useRef<T>(null)
  const { mainRef } = useShell()
  const route = useRoute()
  const navCount = useDemo(selectNavCount)
  const hit = route?.fragment === fragment
  useEffect(() => {
    const main = mainRef.current
    const el = ref.current
    if (!hit || !main || !el) return
    scrollWithin(main, el)
  }, [hit, navCount, mainRef])
  return ref
}

/** Scroll main to a fragment target by id, if it is rendered (the shell calls it after navigating). */
export function scrollToFragment(main: HTMLElement, fragment: string): boolean {
  const el = findWithin(main, fragment)
  if (!el) return false
  scrollWithin(main, el)
  return true
}
