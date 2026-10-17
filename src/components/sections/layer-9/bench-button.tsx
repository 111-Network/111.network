import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Look of a bench button: inverted primary, outlined, or the selected (inverted) toggle. */
export type BenchButtonTone = "primary" | "outline" | "active"

/** Props of BenchButton. */
export interface BenchButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "onClick" | "type" | "disabled"> {
  /** False = shown but inert (aria-disabled), so focus never drops off a button the visitor just pressed. */
  available?: boolean
  /**
   * True = natively disabled and out of the tab order: for a bench that can
   * never act (a device with no agent), where there is no focus to keep.
   */
  disabled?: boolean
  tone?: BenchButtonTone
  onPress: () => void
  children: ReactNode
}

const TONE: Record<BenchButtonTone, string> = {
  primary:
    "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  outline: "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
  active:
    "border-foreground bg-foreground text-background focus-visible:ring-offset-2 focus-visible:ring-offset-background",
}

/**
 * A real <button> in the site's toggle / CTA classes (DESIGN.md §6), zero
 * radius, 44 px tall below sm. An unavailable one stays focusable with
 * aria-disabled and ignores presses; a disabled one leaves the tab order.
 */
export function BenchButton({
  available = true,
  disabled = false,
  tone = "outline",
  onPress,
  className,
  children,
  ...rest
}: BenchButtonProps) {
  const works = available && !disabled
  return (
    <button
      type="button"
      disabled={disabled || undefined}
      aria-disabled={works || disabled ? undefined : true}
      onClick={works ? onPress : undefined}
      className={cn(
        "inline-flex min-h-11 items-center justify-center border px-3 py-2 text-center font-mono text-[10px] leading-snug uppercase tracking-widest transition-colors duration-200 motion-reduce:transition-none sm:min-h-8",
        "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none",
        works ? TONE[tone] : "cursor-not-allowed border-border text-muted-foreground/50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
