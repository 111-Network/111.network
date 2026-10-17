// Which module renders a route (plan §6.5 "Bundle"). Pure: no React, so vitest checks the mapping.
//
// Level 1 (views/registry.tsx): the router's viewKeyOf(route) picks the view module. Bridge,
// Storage and Repairs have their own keys but share the services dispatcher module.
// Level 2 (views/services/index.tsx): servicePageOf(id) picks the service page inside it. Each is
// its own lazily loaded chunk, so the heavy pages (storage, repairs) load only when opened.
import { viewKeyOf, type DemoRoute, type ViewKey } from "../engine/router"
import type { ServiceId } from "../engine/types"

export type { ViewKey }

/** Every view module key, in sidebar order (the registry must have one entry per key). */
export const VIEW_KEYS: readonly ViewKey[] = [
  "overview",
  "agent",
  "devices",
  "nearby",
  "messages",
  "kb",
  "services",
  "bridge",
  "storage",
  "repairs",
  "settings",
  "not-found",
]

/** The registry key of a route (the router's own mapping). */
export function registryKeyOf(route: DemoRoute): ViewKey {
  return viewKeyOf(route)
}

/** Keys rendered by the services dispatcher (views/services/index.tsx). */
export function isServiceKey(key: ViewKey): boolean {
  return key === "services" || key === "bridge" || key === "storage" || key === "repairs"
}

/** Service pages with their own module; every other service uses the template. */
export type ServicePageKey = "bridge" | "storage" | "repairs" | "gateway" | "template"

export const SERVICE_PAGE_KEYS: readonly ServicePageKey[] = ["template", "bridge", "storage", "repairs", "gateway"]

/** The service page module for a service id. */
export function servicePageOf(id: ServiceId | string): ServicePageKey {
  switch (id) {
    case "bridge":
    case "storage":
    case "repairs":
    case "gateway":
      return id
    default:
      return "template"
  }
}
