import { useSyncExternalStore } from "react"
import { REDUCED_MOTION_QUERY, prefersReducedMotion } from "@/lib/motion"

// CLIENT COMPONENTS ONLY (imports useSyncExternalStore). The non-hook
// prefersReducedMotion() also lives, React-free, in "@/lib/motion".

export { prefersReducedMotion } from "@/lib/motion"

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getServerSnapshot(): boolean {
  return false
}

/** True when the visitor asks for reduced motion; false on the server and during hydration. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, getServerSnapshot)
}
