"use client"

import { useRef, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { FOCUS_RING_OFFSET } from "./classes"
import { segmentedKeyTarget, segmentedTabStop } from "./segmented-keys"

/** One option of a Segmented control. */
export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

/** Props of Segmented. */
export interface SegmentedProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: readonly SegmentedOption<T>[]
  /** Accessible name of the group, e.g. "Interface mode". */
  label: string
  /** Smaller text for tight spots (the sidebar foot). Height stays 44 px. */
  size?: "sm" | "md"
  className?: string
}

/**
 * Single-select radio group (SIMPLE | ADVANCED, RADAR | LIST). Roving tabindex; arrows move and
 * select (logical: ArrowRight is "next" in LTR, "previous" in RTL); Home/End jump.
 */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const disabled = options.map((o) => !!o.disabled)
  const selected = options.findIndex((o) => o.value === value)
  const tabStop = segmentedTabStop(selected, disabled)

  const go = (index: number) => {
    const opt = options[index]
    if (!opt || opt.disabled) return
    if (opt.value !== value) onChange(opt.value)
    refs.current[index]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl"
    const target = segmentedKeyTarget(e.key, index, disabled, rtl)
    if (target === null) return
    e.preventDefault()
    if (target >= 0) go(target)
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex", className)}>
      {options.map((o, i) => {
        const on = i === selected
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => go(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative -ms-px min-h-11 border font-mono transition-all duration-200 first:ms-0 hover:z-10 focus-visible:z-20 disabled:pointer-events-none disabled:opacity-50",
              size === "sm" ? "px-3 py-2 text-[10px] tracking-widest" : "px-4 py-2 text-xs",
              FOCUS_RING_OFFSET,
              on
                ? "z-10 border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
