import { useSyncExternalStore } from "react"
import { buildDeviceUrl, parseDeviceParam } from "@/lib/device-param"
import { DEFAULT_DEVICE, isDeviceId, type DeviceId } from "@/lib/devices"

// Page-level "follow one device" store (plan §2). One choice, shared by the
// L1 chips, L3, L8, L9 and the terminal, mirrored to `?device=<id>`.
//
// CLIENT COMPONENTS ONLY: this module imports useSyncExternalStore, which a
// Server Component may not import (next build fails). In a Server Component
// or plain TS module import the URL helpers from "@/lib/device-param".

export { DEVICE_PARAM, buildDeviceUrl, parseDeviceParam } from "@/lib/device-param"

let current: DeviceId | null = null
const listeners = new Set<() => void>()

function readUrl(): DeviceId {
  return typeof window === "undefined" ? DEFAULT_DEVICE : parseDeviceParam(window.location.search)
}

function ensureInit(): DeviceId {
  if (current === null) current = readUrl()
  return current
}

function emit() {
  for (const listener of listeners) listener()
}

/** Adopt the URL's device if it differs (back/forward, or a page mounted after a client-side navigation). */
function syncFromUrl() {
  const next = readUrl()
  if (next !== current) {
    current = next
    emit()
  }
}

/** Subscribe to device changes (useSyncExternalStore contract); returns the unsubscribe. */
export function subscribeDevice(listener: () => void): () => void {
  ensureInit()
  const first = listeners.size === 0
  listeners.add(listener)
  if (first) {
    window.addEventListener("popstate", syncFromUrl)
    // The first subscriber mounts with the page: re-read ?device= in case a
    // client-side navigation (e.g. a Link to /?device=gpu-pc) changed it while
    // nothing was listening.
    syncFromUrl()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener("popstate", syncFromUrl)
  }
}

/** The followed device right now (for event handlers, e.g. the terminal's `devices`). */
export function getCurrentDevice(): DeviceId {
  return ensureInit()
}

function getServerSnapshot(): DeviceId {
  return DEFAULT_DEVICE
}

/** Follow `id` page-wide: updates every subscriber and `?device=` (replaceState: hash kept, no scroll). */
export function setDevice(id: DeviceId): void {
  if (!isDeviceId(id)) return
  ensureInit()
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", buildDeviceUrl(window.location, id))
  }
  if (id === current) return
  current = id
  emit()
}

/** The followed device; renders DEFAULT_DEVICE on the server and during hydration. */
export function useDevice(): DeviceId {
  return useSyncExternalStore(subscribeDevice, getCurrentDevice, getServerSnapshot)
}
