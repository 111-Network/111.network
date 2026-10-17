// Hash routes of the demo (plan §6.5; real `app/location.ts` + `lib/nav.ts`). Pure: no window.
//
// Everything after the first "#" is the route: "#/devices/radio-board", "#/overview#needs-you".
// A "?query" and a second "#fragment" are split off the path; the fragment is kept on the route
// (Overview scrolls to "needs-you"). The one deliberate deviation from the real dashboard: an EMPTY
// hash opens Overview, not the Agent ("#/" is still the Agent).
import type { LayerNumber } from "@/lib/layers"
import type { ServiceId } from "./types"

/** Where an empty hash lands (plan §6.1). */
export const DEFAULT_PATH = "/overview"

/** The real dashboard's default route: the Agent. */
export const AGENT_PATH = "/"

interface RouteBase {
  /** Canonical path, no "#": "/devices/radio-board". */
  path: string
  /** The second fragment ("needs-you"), or null. */
  fragment: string | null
}

export type DemoRoute =
  | (RouteBase & { view: "agent" })
  | (RouteBase & { view: "overview" })
  | (RouteBase & { view: "devices" })
  | (RouteBase & { view: "device"; id: string })
  | (RouteBase & { view: "nearby" })
  | (RouteBase & { view: "messages" })
  | (RouteBase & { view: "conversation"; peer: string })
  | (RouteBase & { view: "kb" })
  | (RouteBase & { view: "kb-drawer"; drawer: string })
  | (RouteBase & { view: "kb-note"; drawer: string; note: string })
  | (RouteBase & { view: "service"; id: string })
  | (RouteBase & { view: "settings" })
  | (RouteBase & { view: "settings-layer"; layer: LayerNumber })
  | (RouteBase & { view: "not-found" })

export type DemoView = DemoRoute["view"]

/** "/overview#needs-you" -> "/overview"; "/x?y" -> "/x"; "/devices/" -> "/devices"; "" -> "/". */
export function cleanPath(raw: string): string {
  const cut = raw.search(/[?#]/)
  const path = cut < 0 ? raw : raw.slice(0, cut)
  const trimmed = path.replace(/\/+$/, "")
  if (trimmed === "") return "/"
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

/** The fragment inside a route: "/overview#needs-you" -> "needs-you"; none or empty -> null. */
export function fragmentOf(raw: string): string | null {
  const i = raw.indexOf("#")
  if (i < 0) return null
  const frag = raw.slice(i + 1)
  return frag === "" ? null : frag
}

/** location.hash -> the route string inside it ("#/x" -> "/x"); empty -> DEFAULT_PATH. */
export function pathFromHash(hash: string): string {
  const body = hash.startsWith("#") ? hash.slice(1) : hash
  return body === "" ? DEFAULT_PATH : body
}

function decode(segment: string): string | null {
  try {
    const s = decodeURIComponent(segment)
    return s === "" ? null : s
  } catch {
    return null
  }
}

const enc = (s: string): string => encodeURIComponent(s)

/** Route builders: always use these instead of string concatenation. */
export const PATHS = {
  agent: AGENT_PATH,
  overview: "/overview",
  devices: "/devices",
  device: (id: string): string => `/devices/${enc(id)}`,
  nearby: "/nearby",
  messages: "/messages",
  conversation: (peer: string): string => `/messages/${enc(peer)}`,
  kb: "/kb",
  kbDrawer: (drawer: string): string => `/kb/${enc(drawer)}`,
  kbNote: (drawer: string, note: string): string => `/kb/${enc(drawer)}/${enc(note)}`,
  service: (id: ServiceId | string): string => `/services/${enc(id)}`,
  settings: "/settings",
  settingsLayer: (n: LayerNumber): string => `/settings/l${n}`,
  /** The header badge target (real `attentionHref`). */
  needsYou: "/overview#needs-you",
} as const

function routeOf(path: string, fragment: string | null): DemoRoute {
  const notFound: DemoRoute = { view: "not-found", path, fragment }
  if (path === "/") return { view: "agent", path, fragment }
  const parts = path.slice(1).split("/")
  const seg: string[] = []
  for (const p of parts) {
    const d = decode(p)
    if (d === null) return notFound
    seg.push(d)
  }
  const [head, a, b] = seg
  const n = seg.length
  switch (head) {
    case "overview":
      return n === 1 ? { view: "overview", path, fragment } : notFound
    case "devices":
      if (n === 1) return { view: "devices", path, fragment }
      return n === 2 ? { view: "device", id: a, path: PATHS.device(a), fragment } : notFound
    case "nearby":
      return n === 1 ? { view: "nearby", path, fragment } : notFound
    case "messages":
      if (n === 1) return { view: "messages", path, fragment }
      return n === 2 ? { view: "conversation", peer: a, path: PATHS.conversation(a), fragment } : notFound
    case "kb":
      if (n === 1) return { view: "kb", path, fragment }
      if (n === 2) return { view: "kb-drawer", drawer: a, path: PATHS.kbDrawer(a), fragment }
      return n === 3 ? { view: "kb-note", drawer: a, note: b, path: PATHS.kbNote(a, b), fragment } : notFound
    case "services":
      return n === 2 ? { view: "service", id: a, path: PATHS.service(a), fragment } : notFound
    case "settings": {
      if (n === 1) return { view: "settings", path, fragment }
      const m = n === 2 ? /^l([0-9])$/.exec(a) : null
      if (!m) return notFound
      const layer = Number(m[1]) as LayerNumber
      return { view: "settings-layer", layer, path: PATHS.settingsLayer(layer), fragment }
    }
    default:
      return notFound
  }
}

/**
 * Parse a route string ("/devices/x", "/overview#needs-you", "devices?y"). Unknown -> view "not-found".
 * One leading "#" is dropped first, so a hash passed by mistake ("#/devices", hashFor(x)) still opens
 * its route instead of reading as the Agent with a fragment.
 */
export function parsePath(raw: string): DemoRoute {
  const path = raw.startsWith("#") ? raw.slice(1) : raw
  return routeOf(cleanPath(path), fragmentOf(path))
}

/** Parse location.hash. Empty -> Overview; "#/" -> Agent. */
export function parseHash(hash: string): DemoRoute {
  return parsePath(pathFromHash(hash))
}

/** The route string of a route: its canonical path plus "#fragment" when it has one. */
export function formatRoute(route: Pick<DemoRoute, "path" | "fragment">): string {
  return route.fragment ? `${route.path}#${route.fragment}` : route.path
}

/** The location.hash for a route string: "/devices" -> "#/devices". */
export function hashFor(path: string): string {
  return `#${path}`
}

/** Same route? Compares canonical path and fragment. */
export function sameRoute(a: Pick<DemoRoute, "path" | "fragment"> | null, b: Pick<DemoRoute, "path" | "fragment"> | null): boolean {
  if (a === null || b === null) return a === b
  return a.path === b.path && a.fragment === b.fragment
}

/** Is the sidebar row for `href` the current page? "/" and "/settings" match exactly; others also match children. */
export function isActive(href: string, path: string): boolean {
  if (href === path) return true
  if (href === "/" || href === "/settings") return false
  return path.startsWith(`${href}/`)
}

/**
 * Which view module (and slice) renders a route. Bridge, Storage and Repairs are service ids with
 * their own views; every other service id uses the service page template ("services").
 */
export type ViewKey =
  | "agent"
  | "overview"
  | "devices"
  | "nearby"
  | "messages"
  | "kb"
  | "services"
  | "bridge"
  | "storage"
  | "repairs"
  | "settings"
  | "not-found"

export function viewKeyOf(route: DemoRoute): ViewKey {
  switch (route.view) {
    case "agent":
    case "overview":
    case "devices":
    case "nearby":
    case "messages":
    case "kb":
    case "settings":
    case "not-found":
      return route.view
    case "device":
      return "devices"
    case "conversation":
      return "messages"
    case "kb-drawer":
    case "kb-note":
      return "kb"
    case "settings-layer":
      return "settings"
    case "service":
      return route.id === "bridge" || route.id === "storage" || route.id === "repairs" ? route.id : "services"
  }
}
