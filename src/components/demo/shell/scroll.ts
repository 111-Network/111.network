// Scrolling inside the shell's main area. React-free; call these from effects and handlers only
// (they touch the DOM). Never scrollIntoView: that also scrolls the page, which would pull the home
// page to the Layer 4 window whenever its demo navigates.
import { scrollBehavior } from "@/lib/motion"

/** The scrollTop that puts `target` at the top of `container` (both laid out). */
export function offsetWithin(container: Element, target: Element, scrollTop: number): number {
  return Math.max(0, target.getBoundingClientRect().top - container.getBoundingClientRect().top + scrollTop)
}

/** Scroll `container` so `target` sits at its top. Smooth unless reduced motion; it answers a click. */
export function scrollWithin(container: HTMLElement, target: Element): void {
  container.scrollTo({ top: offsetWithin(container, target, container.scrollTop), behavior: scrollBehavior() })
}

/** The element with `id` inside `container`, or null (ids from route fragments are not trusted). */
export function findWithin(container: HTMLElement, id: string): HTMLElement | null {
  const el = container.ownerDocument.getElementById(id)
  return el && container.contains(el) ? el : null
}
