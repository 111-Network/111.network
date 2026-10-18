// The live-region throttle and writer (real os/40-interface/ui/src/app/LiveRegion.tsx, ported). Pure:
// time and timers are injected, so the shell feeds them from the demo scheduler (virtual clock,
// pausable) and the tests from a fake. Nothing here reads Date.now or calls setTimeout itself.

export const ANNOUNCE_INTERVAL_MS = 2000
export const REPEAT_GAP_MS = 80
export const SETTLE_MS = 2000

/** A timer source: run `fn` after `ms`; the return value cancels it. */
export type SetTimer = (fn: () => void, ms: number) => () => void

export interface AnnouncerDeps {
  /** Receives each message that is let through. */
  emit: (text: string) => void
  now: () => number
  setTimer: SetTimer
  intervalMs?: number
}

/**
 * At most one message per interval. A message that arrives early is held and sent when the interval
 * ends; a newer held message replaces an older one (screen readers only need the latest state).
 */
export interface Announcer {
  (text: string): void
  /** Drop a held message and its timer (unmount). */
  dispose(): void
}

export function createAnnouncer(deps: AnnouncerDeps): Announcer {
  const interval = deps.intervalMs ?? ANNOUNCE_INTERVAL_MS
  let lastAt = Number.NEGATIVE_INFINITY
  let held: string | null = null
  let cancel: (() => void) | null = null

  const send = (text: string) => {
    lastAt = deps.now()
    deps.emit(text)
  }

  const announce = ((text: string) => {
    if (text === "") return
    const wait = lastAt + interval - deps.now()
    if (wait <= 0 && cancel === null) {
      send(text)
      return
    }
    held = text
    if (cancel !== null) return
    cancel = deps.setTimer(() => {
      cancel = null
      const next = held
      held = null
      if (next !== null) send(next)
    }, Math.max(0, wait))
  }) as Announcer
  announce.dispose = () => {
    cancel?.()
    cancel = null
    held = null
  }
  return announce
}

export interface RegionWriterDeps {
  /** Puts text into the live region (a state setter). */
  set: (text: string) => void
  setTimer: SetTimer
  /** How long the region stays empty before the same words are written again. */
  repeatGapMs?: number
}

/**
 * Writes to the live region. A screen reader announces a CHANGE, so the same sentence twice in a row
 * would be silent: it empties the region first and writes the words again a moment later.
 */
export interface RegionWriter {
  show(text: string): void
  cancel(): void
}

export function createRegionWriter(deps: RegionWriterDeps): RegionWriter {
  const gap = deps.repeatGapMs ?? REPEAT_GAP_MS
  let shown = ""
  let pending: (() => void) | null = null
  const apply = (text: string) => {
    shown = text
    deps.set(text)
  }
  const cancel = () => {
    pending?.()
    pending = null
  }
  return {
    show(text) {
      cancel()
      if (text !== "" && text === shown) {
        apply("")
        pending = deps.setTimer(() => {
          pending = null
          apply(text)
        }, gap)
      } else apply(text)
    },
    cancel,
  }
}
