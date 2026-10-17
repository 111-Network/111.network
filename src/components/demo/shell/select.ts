// Module-scope selectors for the shell and the views (React-free). useDemo(selector) memoises on the
// selector's identity, so pass these (or other module-scope functions), never an inline arrow.
import type { DemoState } from "../engine/slices"
import type { LayoutPref, UiMode } from "../engine/types"

export const selectMode = (s: DemoState): UiMode => s.core.mode
export const selectNavCount = (s: DemoState): number => s.core.navCount
export const selectAlias = (s: DemoState): string => s.core.alias
/** Virtual "now": moves only when an action happens (use it for "2 min ago"). */
export const selectNow = (s: DemoState): number => s.core.now
export const selectDrawerOpen = (s: DemoState): boolean => s.core.drawerOpen
export const selectLayoutPref = (s: DemoState): LayoutPref => s.core.layout
export const selectRailCollapsed = (s: DemoState): boolean => s.core.railCollapsed
export const selectFragment = (s: DemoState): string | null => s.core.route?.fragment ?? null
