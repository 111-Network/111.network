// Static Layer 8 copy shared by the server section and its client islands.
// Plan §5 L8; no sizes, thresholds, percentages or tech names (W1).

/** The hub shelf's four volumes (os/README.md layer 8). */
export const HUB_SHELF = ["maps", "encyclopedias", "updates", "patches"] as const

/** The shared-log caption. */
export const SHARED_LOG_CAPTION = "Optional, append-only, small, adopted."

/** The tiny static glyph: two nodes, the same entries (block shades, no dots) in the same order. */
export const SHARED_LOG_GLYPH = ["A │ B", "──┼──", "█ │ █", "▓ │ ▓", "░ │ ░"].join("\n")

/** The glyph's line under the drawing (plan §5 L8, verbatim). index.tsx reads the bar aloud as "and". */
export const SHARED_LOG_LINE = "A │ B: same entries, same order"
