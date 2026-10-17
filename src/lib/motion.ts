// React-free motion helpers, for event handlers and plain TS modules.
// The hook form lives in "@/hooks/use-reduced-motion" (client components only).

/** The media query behind every reduced-motion decision. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/** Non-hook read of the reduced-motion preference, for event handlers (false on the server). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false
}

/** `behavior` for scrollIntoView / scrollTo: "auto" under reduced motion, else "smooth". */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth"
}
