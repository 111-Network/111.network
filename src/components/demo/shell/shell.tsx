// The demo shell (real app/App.tsx Shell, ported under plan §6.5): sidebar, header, the main area
// with the routed view, one polite live region. It renders inside a DemoStoreProvider and sizes
// itself to its parent, so the same tree fills /demo and the Layer 4 window on the home page.
//
// Port rules (plan §6.5):
// 1. The root is an @container; inside it every `lg:` is `@min-[1024px]:` (and `max-lg:` is
//    `@max-[1024px]:`, Tailwind 4's "width < 1024px").
// 2. No viewport units: the root fills its parent; the main area is the one scroll container.
// 3. No matchMedia: a ResizeObserver on the root decides docked vs drawer (unless `layout` is forced).
// 4. The drawer and its overlay are `absolute` inside this `relative overflow-hidden` root; no body
//    scroll lock; `inert` on the content column only while the drawer is open. Nothing is fixed.
// 5. The node chip badge is plain device words (world.self.badge, "LAPTOP").
// Embedded (the L4 window, memory router): no page landmarks of its own (no <main>, no second
// "Main" nav, no skip button) and view headings start at 3; see ShellContextValue.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { SITE_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"
import { useDemo, useDemoAutoPause, useDemoStore, useDispatch, useRoute } from "../engine/react"
import { routeTitle } from "../engine/selectors"
import { scrollToFragment, ShellProvider, type ShellContextValue } from "./context"
import { SHELL_COPY } from "./copy"
import { Header } from "./header"
import { isDrawerActive, isFillRoute, isWide, needsMeasure, resolveLayout } from "./layout"
import { LiveRegion, useLiveRegion } from "./live-region"
import { RouteView } from "./route-view"
import { selectDrawerOpen, selectLayoutPref, selectNavCount, selectRailCollapsed } from "./select"
import { Sidebar, type CloseFocus } from "./sidebar"
import { SkipToMain } from "./skip-to-main"

export interface ShellProps {
  /** Classes for the shell root; it must get a height from its parent (default "h-full"). */
  className?: string
  /** Id of the main area. /demo passes DEMO_MAIN_ID so the page's skip button can reach it. */
  mainId?: string
  /**
   * Render the shell's own skip button first in the root. Default: on, except when embedded. /demo
   * renders one at the top of the page instead and passes false.
   */
  skipLink?: boolean
  /**
   * Embedded in another page (the Layer 4 window): the main area is a labelled region instead of a
   * <main>, the sidebar nav is "Dashboard", there is no skip button and view headings start at 3.
   * Default: the memory router (the teaser) is embedded, the url router (/demo) is not.
   */
  embedded?: boolean
}

export function Shell({ className = "h-full", mainId: mainIdProp, skipLink, embedded: embeddedProp }: ShellProps) {
  const store = useDemoStore()
  const embedded = embeddedProp ?? store.options.router === "memory"
  const showSkip = skipLink ?? !embedded
  const dispatch = useDispatch()
  const uid = useId()
  const ids = useMemo(
    () => ({
      sidebar: `${uid}-sidebar`,
      close: `${uid}-close`,
      settings: `${uid}-settings`,
      unavailable: `${uid}-unavailable`,
      menu: `${uid}-menu`,
    }),
    [uid],
  )
  const mainId = mainIdProp ?? `${uid}-main`

  const route = useRoute()
  const layoutPref = useDemo(selectLayoutPref)
  const railCollapsed = useDemo(selectRailCollapsed)
  const drawerOpen = useDemo(selectDrawerOpen)
  const navCount = useDemo(selectNavCount)
  const title = useDemo(routeTitle)
  const fragment = route?.fragment ?? null

  // ------------------------------------------------------------------ root, measuring, clock pause
  const rootEl = useRef<HTMLDivElement | null>(null)
  const mainEl = useRef<HTMLElement | null>(null)
  // A callback ref, so the main area can be a <main> or a <div role="region"> with one ref object.
  const mainRef = useCallback((node: HTMLElement | null) => {
    mainEl.current = node
  }, [])
  const autoPause = useDemoAutoPause<HTMLDivElement>()
  const rootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootEl.current = node
      autoPause(node)
    },
    [autoPause],
  )

  const [wide, setWide] = useState<boolean | null>(null)
  useEffect(() => {
    const el = rootEl.current
    if (!needsMeasure({ layout: layoutPref }) || !el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      const next = isWide(entry.contentRect.width)
      setWide(next)
      // Widening to the docked layout drops an open drawer (real Shell: `if (desktop) setDrawerOpen(false)`).
      if (next && store.getSnapshot().core.drawerOpen) store.dispatch({ type: "core/setDrawer", open: false })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [store, layoutPref])

  const layout = resolveLayout({ layout: layoutPref, railCollapsed }, wide)
  const drawerActive = isDrawerActive(layout, drawerOpen)

  // ------------------------------------------------------------------------------- drawer focus
  // Where focus goes once the drawer is gone (it cannot move while the content column is inert).
  const closeFocus = useRef<CloseFocus | null>(null)
  const wasActive = useRef(false)
  useEffect(() => {
    const doc = rootEl.current?.ownerDocument
    if (!doc) return
    if (drawerActive) {
      wasActive.current = true
      doc.getElementById(ids.close)?.focus()
      return
    }
    if (!wasActive.current) return
    wasActive.current = false
    const target = closeFocus.current
    closeFocus.current = null
    // Widened to docked: the sidebar stays on screen, so focus stays where it is.
    if (layout !== "drawer") return
    // Closed by a navigation (a row, the back button): the new view. Closed on purpose: MENU.
    if (target === "menu") doc.getElementById(ids.menu)?.focus()
    else mainEl.current?.focus()
  }, [drawerActive, layout, ids])

  const closeDrawer = useCallback(
    (focus: CloseFocus) => {
      closeFocus.current = focus
      dispatch({ type: "core/setDrawer", open: false })
    },
    [dispatch],
  )
  const onNavigate = useCallback(() => {
    if (store.getSnapshot().core.drawerOpen) closeFocus.current = "main"
  }, [store])
  const openDrawer = useCallback(() => dispatch({ type: "core/setDrawer", open: true }), [dispatch])

  // ------------------------------------------------------------------------- navigation effects
  // Every route change starts the main area at the top, or at the fragment's target when it is there.
  useEffect(() => {
    const main = mainEl.current
    if (!main) return
    if (fragment && scrollToFragment(main, fragment)) return
    main.scrollTop = 0
  }, [navCount, fragment])

  // /demo only: the tab title follows the view. The L4 window (memory router) never touches the document.
  const urlRouter = store.options.router === "url"
  useEffect(() => {
    if (!urlRouter || title === "") return
    const wanted = `${title} · ${SHELL_COPY.pageTitle} · ${SITE_NAME}`
    document.title = wanted
    // The page's <title> hydrates after this island and puts the server title back on a deep link,
    // so re-apply ours whenever its text changes under us while this view is open.
    const el = document.querySelector("head > title")
    if (!el) return
    const observer = new MutationObserver(() => {
      if (document.title !== wanted) document.title = wanted
    })
    observer.observe(el, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [urlRouter, title])

  // ------------------------------------------------------------------------------- live region
  const [liveText, announce] = useLiveRegion(store)
  const ctx = useMemo<ShellContextValue>(
    () => ({ mainId, mainRef: mainEl, announce, embedded, headingBase: embedded ? 3 : 1 }),
    [mainId, announce, embedded],
  )

  const fill = isFillRoute(route)
  const mainClass = cn("flex min-h-0 flex-1 flex-col overflow-y-auto outline-none", fill && "@max-[1024px]:overflow-hidden")
  const content = (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 @min-[1024px]:px-8", fill && "min-h-0 @max-[1024px]:p-0")}>
      {route ? <RouteView route={route} /> : null}
    </div>
  )

  return (
    <ShellProvider value={ctx}>
      <div
        ref={rootRef}
        data-demo-shell=""
        data-layout={layout}
        className={cn("@container relative flex w-full min-w-0 overflow-hidden bg-background font-mono text-foreground", className)}
      >
        {showSkip ? <SkipToMain targetId={mainId}>{SHELL_COPY.skip}</SkipToMain> : null}
        <Sidebar ids={ids} layout={layout} drawerActive={drawerActive} onClose={closeDrawer} onNavigate={onNavigate} />
        <div inert={drawerActive} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Header layout={layout} menuId={ids.menu} sidebarId={ids.sidebar} drawerActive={drawerActive} onMenu={openDrawer} />
          {/* On the home page the window sits inside that page's <main>: a nested <main> is invalid, so it is a region there. */}
          {embedded ? (
            <div role="region" aria-label={SHELL_COPY.embedded.region} id={mainId} ref={mainRef} tabIndex={-1} className={mainClass}>
              {content}
            </div>
          ) : (
            <main id={mainId} ref={mainRef} tabIndex={-1} className={mainClass}>
              {content}
            </main>
          )}
        </div>
        <LiveRegion text={liveText} />
      </div>
    </ShellProvider>
  )
}
