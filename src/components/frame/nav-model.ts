import { LAYERS, layerByN, type LayerNumber } from "@/lib/layers"

// Pure helpers of the nav (plan §4.1): scroll-spy choice, depth-strip fills,
// readouts and the "plain click" test. React-free and DOM-free, so the nav's
// logic is unit-tested in plain node.

/**
 * The reading line, as a fraction of the viewport height from the top. The
 * section crossing it is the active layer, and the depth strip fills against
 * the same line, so both always agree.
 */
export const READING_LINE_PERCENT = 30

/** READING_LINE_PERCENT as a fraction (multiply by innerHeight). */
export const READING_LINE = READING_LINE_PERCENT / 100

/** IntersectionObserver rootMargin for a 1%-tall band at the reading line: "-30% 0px -69% 0px". */
export const SPY_ROOT_MARGIN = `-${READING_LINE_PERCENT}% 0px -${100 - READING_LINE_PERCENT - 1}% 0px`

/**
 * The active layer from the set of layers whose section crosses the reading
 * band: the deepest one (at a boundary the section just entered wins), or null
 * when the band is above Layer 0 or below Layer 9.
 */
export function pickActive(intersecting: Iterable<number>): LayerNumber | null {
  let best: LayerNumber | null = null
  for (const n of intersecting) {
    const layer = layerByN(n)
    if (layer && (best === null || layer.n > best)) best = layer.n
  }
  return best
}

/** The part of a section's box the strip needs (viewport coordinates). */
export interface SectionBox {
  top: number
  height: number
}

/**
 * How full each of the ten depth-strip segments is, in [0, 1]: segment N is
 * the share of section layer-N already above the reading line. A missing
 * section reads 0. Values are rounded to 1/1000 so tiny scrolls do not rewrite styles.
 */
export function segmentFills(boxes: readonly (SectionBox | null)[], line: number): number[] {
  return LAYERS.map((_, i) => {
    const box = boxes[i]
    if (!box) return 0
    if (box.height <= 0) return line >= box.top ? 1 : 0
    const f = (line - box.top) / box.height
    return Math.round(Math.min(1, Math.max(0, f)) * 1000) / 1000
  })
}

/** Tailwind `lg` (64rem): the desktop nav shows from here, the mobile MENU below it. */
export const DESKTOP_QUERY = "(min-width: 64rem)"

/** Mobile readout, e.g. "L3/9"; "L–/9" when no layer is active. */
export function readoutShort(active: LayerNumber | null): string {
  return `L${active === null ? "–" : active}/9`
}

/** Accessible name of a layer anchor, e.g. "Layer 3: Local Intelligence". */
export function layerAnchorLabel(n: LayerNumber): string {
  const layer = layerByN(n)
  return layer ? `Layer ${layer.n}: ${layer.title}` : `Layer ${n}`
}

/** The parts of a mouse event that decide whether a link click is ours to handle. */
export interface ClickLike {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}

/** True for a plain primary click; modified clicks (new tab, download) keep the browser default. */
export function isPlainClick(e: ClickLike): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented
}
