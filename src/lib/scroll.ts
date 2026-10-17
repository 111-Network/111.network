import { layerByN } from "@/lib/layers"
import { scrollBehavior } from "@/lib/motion"

// In-page navigation shared by the nav rail, the mobile sheet, the hero CTA,
// the footer and the terminal's `goto <n>` (plan §4.1, §4.4). React-free; call
// it from event handlers only (it touches window and document).
//
// - honours reduced motion (behavior "auto" instead of "smooth");
// - lands below the fixed nav through the target's `scroll-mt-nav` class;
// - writes the hash with history.replaceState (deep-linkable, no history spam,
//   Next's router stays in sync, `?device=` is kept);
// - moves focus to the target (tabindex -1 is added if needed) so keyboard
//   and screen-reader users continue from there.

/** Options of scrollToAnchor. */
export interface ScrollToAnchorOptions {
  /** Write `#id` to the address bar with replaceState. Default true. */
  updateHash?: boolean
  /** Move focus to the target without a second scroll. Default true. */
  focus?: boolean
}

/** Scroll to the element with `id` (a leading "#" is fine). Returns false when it is not on the page. */
export function scrollToAnchor(id: string, { updateHash = true, focus = true }: ScrollToAnchorOptions = {}): boolean {
  if (typeof document === "undefined") return false
  const clean = id.startsWith("#") ? id.slice(1) : id
  const el = document.getElementById(clean)
  if (!el) return false
  el.scrollIntoView({ behavior: scrollBehavior(), block: "start" })
  if (updateHash) window.history.replaceState(null, "", `#${clean}`)
  if (focus) {
    if (!el.hasAttribute("tabindex") && !isFocusable(el)) el.setAttribute("tabindex", "-1")
    el.focus({ preventScroll: true })
  }
  return true
}

/** Scroll to section #layer-N. Returns false for a number outside 0..9 or a missing section. */
export function scrollToLayer(n: number, options?: ScrollToAnchorOptions): boolean {
  const layer = layerByN(n)
  return layer ? scrollToAnchor(layer.id, options) : false
}

function isFocusable(el: HTMLElement): boolean {
  return el.matches("a[href], button, input, select, textarea, [contenteditable='true']")
}
