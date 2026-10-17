import { useSyncExternalStore } from "react"

// Open state of the nav's two overlays, the desktop INSTALL popover and the
// mobile MENU sheet (plan §4.1). Their code is loaded after first paint
// (nav-overlays.tsx), so for a moment the header shows placeholder buttons.
// Keeping the state here, outside React, lets it survive the swap:
// - a click on a placeholder opens the overlay as soon as its code arrives;
// - a placeholder that is removed while it has focus hands the focus on to
//   the real trigger that replaces it.
//
// The setters are plain functions for event handlers and ref callbacks;
// useNavOverlayOpen is for client components only.

/** The two lazily loaded nav overlays. */
export type NavOverlay = "install" | "menu"

type Listener = () => void

const open: Record<NavOverlay, boolean> = { install: false, menu: false }
const focusHandoff: Record<NavOverlay, boolean> = { install: false, menu: false }
const listeners = new Set<Listener>()

/** Open or close an overlay; subscribers are notified only on a real change. */
export function setNavOverlayOpen(id: NavOverlay, next: boolean): void {
  if (open[id] === next) return
  open[id] = next
  for (const listener of listeners) listener()
}

/** Whether an overlay is open right now (for handlers and effects). */
export function isNavOverlayOpen(id: NavOverlay): boolean {
  return open[id]
}

/** Subscribe to open/close changes of either overlay. Returns the unsubscribe. */
export function subscribeNavOverlays(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getInstallOpen = (): boolean => open.install
const getMenuOpen = (): boolean => open.menu
const getServerClosed = (): boolean => false

/** Whether the overlay is open; false on the server and during hydration. */
export function useNavOverlayOpen(id: NavOverlay): boolean {
  return useSyncExternalStore(subscribeNavOverlays, id === "install" ? getInstallOpen : getMenuOpen, getServerClosed)
}

/** A placeholder trigger is being removed while it has focus: its replacement should take the focus. */
export function markNavFocusHandoff(id: NavOverlay): void {
  focusHandoff[id] = true
}

/** True once after markNavFocusHandoff (the flag is cleared by reading it). */
export function takeNavFocusHandoff(id: NavOverlay): boolean {
  const pending = focusHandoff[id]
  focusHandoff[id] = false
  return pending
}
