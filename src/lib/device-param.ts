import { DEFAULT_DEVICE, isDeviceId, type DeviceId } from "@/lib/devices"

// React-free `?device=` helpers: safe in Server Components, route handlers,
// plain TS modules and tests. The client store lives in device-store.ts.

/** Query-string key that carries the followed device. */
export const DEVICE_PARAM = "device"

/** Device id from a location.search string; unknown or missing ids give DEFAULT_DEVICE. */
export function parseDeviceParam(search: string): DeviceId {
  const value = new URLSearchParams(search).get(DEVICE_PARAM)
  return isDeviceId(value) ? value : DEFAULT_DEVICE
}

/** Relative URL with `?device=<id>` set, other params and the hash kept. */
export function buildDeviceUrl(
  location: { pathname: string; search: string; hash: string },
  id: DeviceId,
): string {
  const params = new URLSearchParams(location.search)
  params.set(DEVICE_PARAM, id)
  return `${location.pathname}?${params.toString()}${location.hash}`
}
