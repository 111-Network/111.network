"use client"

import type { ReactNode } from "react"
import { scrollBehavior } from "@/lib/motion"
import { ANCHORS } from "@/lib/site"

// The footer's back-to-top button, its only client leaf besides the in-page
// links (those reuse the nav's AnchorLink from ./nav-anchor-link).

/** Props of BackToTopButton. */
export interface BackToTopButtonProps {
  className?: string
  children: ReactNode
}

/**
 * Scrolls to the very top (instantly under reduced motion), drops a stale
 * `#hash` (keeps `?device=`) and moves keyboard focus to <main>, so the next
 * Tab continues from the top of the content instead of the footer.
 *
 * Same scroll and hash handling as the nav's TopLink (./nav-anchor-link);
 * it adds the focus move because, unlike the logo, it sits at the page bottom.
 * It does not use scrollToAnchor(main): the sticky nav puts <main> one nav
 * height down, so that would stop short of the page top.
 */
export function BackToTopButton({ className, children }: BackToTopButtonProps) {
  function onClick() {
    window.scrollTo({ top: 0, behavior: scrollBehavior() })
    const { pathname, search, hash } = window.location
    if (hash) window.history.replaceState(null, "", `${pathname}${search}`)
    const main = document.getElementById(ANCHORS.main)
    if (main) {
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1")
      main.focus({ preventScroll: true })
    }
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}
