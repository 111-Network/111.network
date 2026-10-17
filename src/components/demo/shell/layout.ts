// Layout decisions of the demo shell (plan §6.5 port rules 1–4). Pure: no React, no window.
//
// The real dashboard asks the VIEWPORT (`matchMedia("(min-width: 1024px)")`). The demo shell also
// renders inside the Layer 4 window on the home page, so it measures its OWN root with a
// ResizeObserver instead, and a forced `layout` option (the L4 teaser's "rail") skips measuring.
import type { CoreState } from "../engine/core"
import { shellLayout, type ShellLayout } from "../engine/selectors"
import type { DemoRoute } from "../engine/router"

/** The shell root width at which the sidebar docks (Tailwind's `lg`, as a container width). */
export const WIDE_MIN_PX = 1024

/** Is a measured shell root wide enough to dock the sidebar? */
export function isWide(width: number): boolean {
  return width >= WIDE_MIN_PX
}

/**
 * "unknown": layout "auto" before the first measurement (the server render and the first client
 * frame). The shell then lets CSS container queries pick: the sidebar hides below 1024 px and the
 * MENU button hides from 1024 px, so nothing jumps once the measurement lands.
 */
export type ResolvedLayout = ShellLayout | "unknown"

/** The layout to render now. `wide` is null until the ResizeObserver has measured the root. */
export function resolveLayout(core: Pick<CoreState, "layout" | "railCollapsed">, wide: boolean | null): ResolvedLayout {
  if (core.layout !== "auto") return core.layout
  if (wide === null) return "unknown"
  return shellLayout(core, wide)
}

/** Does this layout measure the root at all? Forced layouts never do. */
export function needsMeasure(core: Pick<CoreState, "layout">): boolean {
  return core.layout === "auto"
}

/** The drawer is a real, open, modal dialog only in the drawer layout. */
export function isDrawerActive(layout: ResolvedLayout, drawerOpen: boolean): boolean {
  return layout === "drawer" && drawerOpen
}

/** The sidebar draws as the 56 px icon rail. ("unknown" follows the saved collapse choice.) */
export function isRail(layout: ResolvedLayout, core: Pick<CoreState, "railCollapsed">): boolean {
  return layout === "rail" || (layout === "unknown" && core.railCollapsed)
}

/** The `<<` / `>>` collapse button shows only where the person may choose (layout "auto", docked or railed). */
export function canCollapse(core: Pick<CoreState, "layout">, layout: ResolvedLayout): boolean {
  return core.layout === "auto" && layout !== "drawer"
}

/** The MENU button shows in the drawer layout, and (by container query) below 1024 px before measuring. */
export function showsMenu(layout: ResolvedLayout): boolean {
  return layout === "drawer" || layout === "unknown"
}

/**
 * The Agent route is a chat that fills the shell (real App.tsx `fill`): below 1024 px the main area
 * stops scrolling and drops its padding, so the transcript is the one scroll container.
 */
export function isFillRoute(route: DemoRoute | null): boolean {
  return route?.view === "agent"
}
