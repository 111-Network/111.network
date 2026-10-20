// Navigation model of the demo shell (plan §6.2; real os/4-interface/ui/src/lib/nav.ts). Pure data and
// pure functions: no React, no window, so vitest runs it in node. The services group is dynamic: one
// row per registry record in the store.
import { LAYER_PAGES, ROUTE_TITLES } from "../copy/core"
import { PATHS, type DemoRoute } from "../engine/router"
import { layerPageTitle } from "../engine/selectors"
import type { ServiceId, ServiceState, UiMode } from "../engine/types"
import type { DemoService } from "../engine/world"

export type NavSection = "core" | "settings"

export interface NavItem {
  id: string
  label: string
  /** Route path without the "#", e.g. "/devices". Build it with PATHS. */
  href: string
  /** Lowest mode that shows the row. Absent = always. */
  minMode?: UiMode
  section: NavSection
}

/**
 * Sidebar order: the five core rows, then Settings (Essentials and the ten layer pages, numbered,
 * L0 Knowledge to L9 Self-healing). Deviation from the real dashboard (owner, 2026-10-17): every
 * layer page shows in both modes, so the whole stack is visible in the demo; the real one keeps
 * only Messaging & data in simple mode.
 */
export const NAV: readonly NavItem[] = [
  { id: "overview", label: ROUTE_TITLES.overview, href: PATHS.overview, section: "core" },
  { id: "agent", label: ROUTE_TITLES.agent, href: PATHS.agent, section: "core" },
  { id: "devices", label: ROUTE_TITLES.devices, href: PATHS.devices, section: "core" },
  { id: "nearby", label: ROUTE_TITLES.nearby, href: PATHS.nearby, section: "core" },
  { id: "messages", label: ROUTE_TITLES.messages, href: PATHS.messages, section: "core" },
  { id: "settings", label: "Essentials", href: PATHS.settings, section: "settings" },
  ...LAYER_PAGES.map(
    (l): NavItem => ({
      id: `settings-l${l.n}`,
      label: layerPageTitle(l.n),
      href: PATHS.settingsLayer(l.n),
      section: "settings",
    }),
  ),
]

export interface ServiceNavItem {
  id: ServiceId
  /** The plain name, e.g. "Local AI agent". */
  label: string
  href: string
  state: ServiceState
}

export interface VisibleNav {
  core: NavItem[]
  /** Services that can run on this device, in registry order. */
  services: ServiceNavItem[]
  /** canRunHere === false: the collapsed "Not available on this device (n)" group. */
  unavailable: ServiceNavItem[]
  settings: NavItem[]
}

/** Does `mode` satisfy a row's `minMode`? */
export function meetsMode(mode: UiMode, minMode: UiMode | undefined): boolean {
  return minMode === undefined || minMode === "simple" || mode === "advanced"
}

function serviceItem(s: DemoService): ServiceNavItem {
  return { id: s.id, label: s.name, href: PATHS.service(s.id), state: s.state }
}

/**
 * Everything the sidebar renders for `mode`. Deviation (owner, 2026-10-17): the services group is
 * advanced only; simple mode keeps the five core rows and Settings.
 */
export function visibleNav(mode: UiMode, services: readonly DemoService[]): VisibleNav {
  const rows = NAV.filter((i) => meetsMode(mode, i.minMode))
  const listed = mode === "advanced" ? services : []
  return {
    core: rows.filter((i) => i.section === "core"),
    services: listed.filter((s) => s.canRunHere).map(serviceItem),
    unavailable: listed.filter((s) => !s.canRunHere).map(serviceItem),
    settings: rows.filter((i) => i.section === "settings"),
  }
}

/** Two-letter glyph for the icon rail: the first two letters of the label, uppercased. */
export function glyphOf(label: string): string {
  return label
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase()
}

/** Is the route one of the settings pages (Essentials or a layer page)? */
export function inSettings(route: DemoRoute | null): boolean {
  return route?.view === "settings" || route?.view === "settings-layer"
}
