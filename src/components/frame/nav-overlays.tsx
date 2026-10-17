"use client"

import dynamic from "next/dynamic"
import { useSyncExternalStore, type ReactNode, type RefCallback } from "react"
import { ANCHORS } from "@/lib/site"
import { AnchorLink } from "./nav-anchor-link"
import { DESKTOP_QUERY } from "./nav-model"
import {
  markNavFocusHandoff,
  setNavOverlayOpen,
  takeNavFocusHandoff,
  useNavOverlayOpen,
  type NavOverlay,
} from "./nav-overlay-store"
import { INSTALL_TRIGGER_CLASS, MENU_TRIGGER_CLASS } from "./nav-styles"

// The nav's two overlays stay off the home page's first-load JS (plan §7 and
// §10, performance). Both are closed at first paint, yet the Radix popover
// (with its positioning code) and the Radix dialog cost about 18 kB gzip
// together. So:
// - the server renders a placeholder button with the trigger's exact markup;
// - after hydration, only the overlay the layout shows is fetched (the INSTALL
//   popover at lg and up, the MENU sheet below lg), through next/dynamic from
//   this client file (a Server Component's dynamic import is not code-split);
// - a click on a placeholder before the code arrives is kept in
//   nav-overlay-store, and the overlay opens as soon as it mounts; keyboard
//   focus on a placeholder moves to the real trigger that replaces it.

/**
 * One ref callback per overlay, created once, so React calls it only on mount
 * and unmount. A placeholder can be swapped twice (the layout gate's, then
 * next/dynamic's loading one), so each one both passes the focus on when it
 * leaves and takes it over when it replaces a focused one.
 */
function handoffRef(id: NavOverlay): RefCallback<HTMLButtonElement> {
  return (node) => {
    if (!node) return
    if (takeNavFocusHandoff(id)) node.focus()
    // React runs a ref's cleanup before the node leaves the DOM, so the focus is still readable here.
    return () => {
      if (node.ownerDocument.activeElement === node) markNavFocusHandoff(id)
    }
  }
}

const HANDOFF_REFS: Record<NavOverlay, RefCallback<HTMLButtonElement>> = {
  install: handoffRef("install"),
  menu: handoffRef("menu"),
}

interface PlaceholderProps {
  id: NavOverlay
  className: string
  children: ReactNode
}

/** The trigger's stand-in: same markup and ARIA as the Radix trigger, and a click opens the overlay once it loads. */
function Placeholder({ id, className, children }: PlaceholderProps) {
  const open = useNavOverlayOpen(id)
  return (
    <button
      ref={HANDOFF_REFS[id]}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      onClick={() => setNavOverlayOpen(id, true)}
      className={className}
    >
      {children}
    </button>
  )
}

const installPlaceholder = (
  <Placeholder id="install" className={INSTALL_TRIGGER_CLASS}>
    INSTALL
  </Placeholder>
)

const menuPlaceholder = (
  <Placeholder id="menu" className={MENU_TRIGGER_CLASS}>
    MENU
  </Placeholder>
)

/** If the popover's code cannot load, INSTALL still works: it becomes a link to the hero's install box. */
function InstallLinkFallback() {
  return (
    <AnchorLink to={ANCHORS.install} className={INSTALL_TRIGGER_CLASS}>
      INSTALL
    </AnchorLink>
  )
}

/** If the sheet's code cannot load, MENU stays an inert placeholder rather than taking the page down. */
function MenuFallback() {
  return menuPlaceholder
}

const LazyInstallPopover = dynamic(
  () => import("./nav-install-popover").then((m) => m.NavInstallPopover, () => InstallLinkFallback),
  { ssr: false, loading: () => installPlaceholder },
)

const LazyMenuSheet = dynamic(
  () => import("./nav-menu-sheet").then((m) => m.NavMenuSheet, () => MenuFallback),
  { ssr: false, loading: () => menuPlaceholder },
)

function subscribeDesktop(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY)
  const handle = () => {
    // Crossing lg hides one overlay's trigger: close both rather than leave one open over a hidden button.
    setNavOverlayOpen("install", false)
    setNavOverlayOpen("menu", false)
    onChange()
  }
  mql.addEventListener("change", handle)
  return () => mql.removeEventListener("change", handle)
}

const getDesktop = (): boolean => window.matchMedia(DESKTOP_QUERY).matches
const getLayoutUnknown = (): boolean | null => null

/** true at lg and up, false below; null on the server and during hydration, when the layout is not known yet. */
function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(subscribeDesktop, getDesktop, getLayoutUnknown)
}

/** Desktop INSTALL: the popover with the install terminal, loaded after hydration at lg and up. */
export function NavInstall() {
  return useIsDesktop() === true ? <LazyInstallPopover /> : installPlaceholder
}

/** Mobile MENU: the full-height layer sheet, loaded after hydration below lg. */
export function NavMenu() {
  return useIsDesktop() === false ? <LazyMenuSheet /> : menuPlaceholder
}
