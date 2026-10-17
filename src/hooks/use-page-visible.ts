import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

function getSnapshot(): boolean {
  return document.visibilityState === "visible"
}

function getServerSnapshot(): boolean {
  return true
}

/** True while the tab is visible (document.visibilityState); true on the server. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
