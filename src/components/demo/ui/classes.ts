// Shared class strings of the /demo primitives (React-free, server-safe).
// Real source: os/interface/ui/src/lib/cx.ts (FOCUS_RING) + components/input.tsx (FIELD_CLASS).

/** Focus ring for every plain control (DESIGN.md §8). */
export const FOCUS_RING = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"

/**
 * Focus ring for a control that is, or can become, white (primary button, pressed toggle,
 * selected segment): the black offset gap keeps the white ring visible (P0 focus rule).
 */
export const FOCUS_RING_OFFSET =
  "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"

/** Focus ring drawn inside the border, for scrollable regions (log tails, diffs). */
export const FOCUS_RING_INSET =
  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground focus-visible:outline-none"

/** Focus ring for a control inside a white band: colours swapped. */
export const FOCUS_RING_ON_LIGHT =
  "focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-foreground focus-visible:outline-none"

/** Small uppercase label (kickers, table heads, chrome captions). */
export const LABEL_CLASS = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

/**
 * Shared field look for inputs and textareas. `text-base` below a 768 px container keeps the
 * font at 16 px so a phone browser does not zoom on focus (real: `md:text-sm`, a viewport query).
 */
export const FIELD_CLASS = [
  "w-full border border-input bg-background px-3 py-2 font-mono text-base text-foreground @min-[768px]:text-sm",
  "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
  FOCUS_RING,
].join(" ")
