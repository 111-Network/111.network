// Status-dot model (React-free). Real source: os/40-interface/ui/src/components/status-dot.tsx.

/** Service / node state. "starting" = grey + blink; "unknown" = hollow grey (stale or not heard). */
export type DotState = "live" | "unset" | "error" | "starting" | "unknown"

/** Every state, in display order. */
export const DOT_STATES: readonly DotState[] = ["live", "unset", "error", "starting", "unknown"]

/** The words a dot always carries (the real dashboard's labels, verbatim). */
export const DOT_LABEL: Readonly<Record<DotState, string>> = {
  live: "LIVE",
  unset: "NOT SET",
  error: "ERROR",
  starting: "STARTING",
  unknown: "UNKNOWN",
}

/**
 * One-character state mark for the icon rail, where the state word does not fit: the rail shows
 * dot + mark, so LIVE and NOT SET never differ by colour alone (WCAG 1.4.1). The row's tooltip and
 * screen-reader text carry the full word.
 */
export const DOT_MARK: Readonly<Record<DotState, string>> = {
  live: "L",
  unset: "N",
  error: "E",
  starting: "S",
  unknown: "?",
}

/**
 * Colour lives on the dot only (DESIGN.md "Status Dots"). Transitional = grey + blink, stale =
 * hollow grey, so shape and motion also carry the state and colour is never the only signal.
 */
export const DOT_CLASS: Readonly<Record<DotState, string>> = {
  live: "bg-status-live",
  unset: "bg-status-unset",
  error: "bg-status-error",
  starting: "bg-status-unset animate-blink",
  unknown: "border border-status-unset",
}

/** True for a value the dot can show. */
export function isDotState(x: unknown): x is DotState {
  return typeof x === "string" && (DOT_STATES as readonly string[]).includes(x)
}

/** The label is bright for a settled state (LIVE / ERROR) and muted while unset, starting or unknown. */
export function dotLabelEmphasis(state: DotState): "strong" | "muted" {
  return state === "live" || state === "error" ? "strong" : "muted"
}

/** Screen-reader text when the visible label is hidden: "Local AI agent: LIVE", or just "LIVE". */
export function statusDotText(state: DotState, name?: string): string {
  const text = DOT_LABEL[state]
  return name ? `${name}: ${text}` : text
}
