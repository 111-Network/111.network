"use client"

import * as RadioGroup from "@radix-ui/react-radio-group"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** One chip in a ChipGroup. */
export interface ChipOption<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

/** Props of ChipGroup. */
export interface ChipGroupProps<T extends string> {
  /** Accessible name of the radiogroup (required), e.g. "device". */
  "aria-label": string
  /** The selected value (controlled). */
  value: T
  /** Called with the newly selected value. */
  onValueChange: (value: T) => void
  options: readonly ChipOption<T>[]
  /** "sm" = 10px uppercase-friendly chips; "md" = text-xs. Default "sm". */
  size?: "sm" | "md"
  /** Disable every chip. */
  disabled?: boolean
  /**
   * Arrow-key axis. Default undefined = all four arrows move (WAI-ARIA radio
   * group; chip rows wrap at 375 px, where Up/Down is natural). Set it only for
   * a strictly one-line or one-column group.
   */
  orientation?: "horizontal" | "vertical"
  /** Classes for the row (flex-wrap gap-2 by default). */
  className?: string
  /** Extra classes for every chip. */
  chipClassName?: string
}

const SIZE = {
  sm: "px-3 text-[10px] tracking-widest",
  md: "px-4 text-xs",
} as const

/**
 * A row of single-choice chips: unstyled Radix RadioGroup (roving tabindex,
 * arrow keys) dressed in the site's Interactive Toggle Button classes.
 */
export function ChipGroup<T extends string>({
  "aria-label": ariaLabel,
  value,
  onValueChange,
  options,
  size = "sm",
  disabled,
  orientation,
  className,
  chipClassName,
}: ChipGroupProps<T>) {
  return (
    <RadioGroup.Root
      aria-label={ariaLabel}
      value={value}
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next)
        if (option) onValueChange(option.value)
      }}
      disabled={disabled}
      orientation={orientation}
      loop
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-none border font-mono transition-colors duration-200 sm:min-h-8 sm:min-w-8",
            // Offset ring: a black gap keeps the white ring visible on the white checked chip
            // (Tab always lands on the checked one in a roving group). DESIGN.md "Focus".
            "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
            "data-[state=unchecked]:border-border data-[state=unchecked]:text-muted-foreground",
            "enabled:data-[state=unchecked]:hover:border-foreground enabled:data-[state=unchecked]:hover:text-foreground",
            "data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background",
            "disabled:cursor-not-allowed disabled:opacity-40",
            SIZE[size],
            chipClassName,
          )}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
