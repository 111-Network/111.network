// Button look (React-free, server-safe). Real source: os/4-interface/ui/src/components/button.tsx.
import { cn } from "@/lib/utils"
import { FOCUS_RING_OFFSET } from "./classes"

export type ButtonVariant = "default" | "primary" | "destructive"
export type ButtonSize = "md" | "sm"

const BASE =
  "group inline-flex min-h-11 items-center justify-center gap-2 border font-mono transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-default aria-disabled:opacity-50"

const SIZE: Readonly<Record<ButtonSize, string>> = {
  md: "px-6 py-3 text-sm",
  sm: "px-3 py-2 text-xs",
}

const VARIANT: Readonly<Record<ButtonVariant, string>> = {
  // CTA secondary (DESIGN.md)
  default: "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
  // CTA primary: inverted, hover flips back to outline
  primary: "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground",
  // Text-only danger: red outline, hover inversion (black on red keeps contrast above 4.5:1)
  destructive: "border-destructive text-destructive hover:bg-destructive hover:text-background",
}

/**
 * Classes of a Button / ButtonLink. The focus ring is always the offset one: primary is a white
 * fill, and the gap keeps every variant's ring readable next to its border.
 */
export function buttonClasses(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  const { variant = "default", size = "md", className } = opts
  return cn(BASE, SIZE[size], VARIANT[variant], FOCUS_RING_OFFSET, className)
}

/** Whether the trailing `->` shows: explicit `arrow` wins, otherwise primary buttons get it. */
export function showsArrow(variant: ButtonVariant, arrow?: boolean): boolean {
  return arrow ?? variant === "primary"
}

/** Classes of the trailing `->`: nudges on hover, stays put under reduced motion. */
export const ARROW_CLASS =
  "transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
