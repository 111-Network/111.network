// Devices slice (#/devices, #/devices/<id>; plan §6.4, layers 1 and 6). UI STATE ONLY: the board
// itself (stage, consent, firmware, region, alias) lives in core (core.radio) and every view reads
// devices through engine/selectors (selectDevices, ownDevice). This slice keeps what only the
// Devices views need: "Not now" on the identify consent, the open flash confirmation, when the
// board was first seen, and a counter that keys the board's setup panel so its drafts start fresh.
//
// The radio flow runs on core actions, whoever dispatches them (Devices and Bridge alike):
//   core/radioPlugged -> core/radioAllowed (consent) -> identified -> devices/flash (the typed
//   device-name confirm, checked here) -> core/radioFlash -> flashed (emits "radio-flashed") ->
//   core/radioRegionSet -> the Long-range radio service STARTING -> LIVE (core, scheduler).
//
// Real source: os/interface/ui/src/views/devices/flash-model.ts (confirmation rules, verbatim) and
// views/devices/flash.tsx (the human-confirmed gate: nothing here can start a flash by itself).
import type { RadioBoard } from "../core"
import { NO_NEEDS, type NeedItem, type SliceCtx } from "../types"
import type { DemoAction } from "./index"

// ------------------------------------------------------------------- the flash confirmation (real flash-model.ts)

export type FlashCheckId = "erase" | "own"

/** The two boxes, in the order the form shows them. */
export const FLASH_CHECK_IDS: readonly FlashCheckId[] = ["erase", "own"]

export interface FlashConfirm {
  checks: Readonly<Record<FlashCheckId, boolean>>
  typed: string
}

export const EMPTY_CONFIRM: FlashConfirm = { checks: { erase: false, own: false }, typed: "" }

/** The name the flash confirm asks for: what the page shows as the board's name (`alias ?? name`). */
export function flashName(radio: Pick<RadioBoard, "alias" | "name">): string {
  return radio.alias ?? radio.name
}

/** The typed name equals the displayed name: both trimmed, case-sensitive, and not empty (real nameMatches). */
export function nameMatches(typed: string, name: string): boolean {
  const want = name.trim()
  return want !== "" && typed.trim() === want
}

export type FlashMissing = FlashCheckId | "name"

/** What the person still has to do, in form order. Empty when the confirmation is complete. */
export function confirmMissing(c: FlashConfirm, name: string): FlashMissing[] {
  const out: FlashMissing[] = []
  for (const id of FLASH_CHECK_IDS) if (!c.checks[id]) out.push(id)
  if (!nameMatches(c.typed, name)) out.push("name")
  return out
}

export function confirmValid(c: FlashConfirm, name: string): boolean {
  return confirmMissing(c, name).length === 0
}

// ---------------------------------------------------------------------------------------- state

export interface DevicesState {
  /** +1 every time a board is plugged in (never reset): keys the board's setup panel and its drafts. */
  boardSeq: number
  /** Virtual ms the current board was first seen, or null with no board. */
  pluggedAt: number | null
  /** Virtual ms the one-time identify consent was given for the current board, or null. */
  consentAt: number | null
  /** "Not now" was pressed on the identify consent of the current board. */
  consentDeclined: boolean
  /** The flash confirmation step is open ("Flash firmware…" was pressed on the offer). */
  flashOpen: boolean
}

/** Every type is "devices/…". The board's own life is core's: dispatch core/radio* for the rest. */
export type DevicesAction =
  /** "Not now" on the identify consent: nothing talks to the board. */
  | { type: "devices/notNow" }
  /** Bring the identify consent back after "Not now". */
  | { type: "devices/askAgain" }
  /** "Flash firmware…" on the offer: open the confirmation. Only while the board is identified. */
  | { type: "devices/openFlash" }
  /** Cancel (or Escape) on the confirmation. */
  | { type: "devices/closeFlash" }
  /**
   * "Flash now". Carried out (core/radioFlash) only while the confirmation is open, the board is
   * identified, both boxes are ticked and the typed name matches the board's name exactly.
   */
  | { type: "devices/flash"; confirm: FlashConfirm; instant?: boolean }

export function initialDevices(): DevicesState {
  return { boardSeq: 0, pluggedAt: null, consentAt: null, consentDeclined: false, flashOpen: false }
}

/** The fields that belong to one board: cleared when it leaves, fresh when the next one comes. */
const NO_BOARD = { pluggedAt: null, consentAt: null, consentDeclined: false, flashOpen: false } as const

function patch(state: DevicesState, next: Partial<DevicesState>): DevicesState {
  const keys = Object.keys(next) as (keyof DevicesState)[]
  return keys.every((k) => next[k] === state[k]) ? state : { ...state, ...next }
}

export function reduceDevices(state: DevicesState, action: DemoAction, ctx: SliceCtx): DevicesState {
  const before = ctx.prev.core.radio
  const radio = ctx.core.radio
  let next = state

  // React to the board's life in core, whoever dispatched it (Devices, Bridge, a test).
  if (before === null && radio !== null) next = { ...next, ...NO_BOARD, boardSeq: next.boardSeq + 1, pluggedAt: ctx.now }
  else if (before !== null && radio === null) next = patch(next, NO_BOARD)
  else if (before !== null && radio !== null && !before.consent && radio.consent) next = patch(next, { consentAt: ctx.now, consentDeclined: false })

  switch (action.type) {
    case "devices/notNow":
      if (radio?.stage === "plugged" && !radio.consent) next = patch(next, { consentDeclined: true })
      break
    case "devices/askAgain":
      next = patch(next, { consentDeclined: false })
      break
    case "devices/openFlash":
      if (radio?.stage === "identified") next = patch(next, { flashOpen: true })
      break
    case "devices/closeFlash":
      next = patch(next, { flashOpen: false })
      break
    case "devices/flash":
      // The human gate: a flash starts only from a complete confirmation of the offer on screen.
      if (next.flashOpen && radio?.stage === "identified" && confirmValid(action.confirm, flashName(radio))) {
        ctx.dispatch({ type: "core/radioFlash", instant: action.instant })
      }
      break
    default:
      break
  }

  // The confirmation belongs to the offer: once the board leaves "identified" it is closed.
  if (next.flashOpen && radio?.stage !== "identified") next = patch(next, { flashOpen: false })
  return next
}

/**
 * The Devices view adds no "needs you" rows: the radio's own setup row (its reason follows the board's
 * stage) and device errors come from core (engine/selectors needsYou).
 */
export function needsDevices(): readonly NeedItem[] {
  return NO_NEEDS
}
