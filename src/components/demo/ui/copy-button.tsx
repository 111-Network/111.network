"use client"

import { useEffect, useRef, useState } from "react"
import { useCopy } from "@/hooks/use-copy"
import { cn } from "@/lib/utils"
import { buttonClasses, type ButtonVariant } from "./button-classes"
import { FIELD_CLASS, FOCUS_RING } from "./classes"

/** Props of CopyButton. */
export interface CopyButtonProps {
  text: string
  /** Idle label, default "copy". */
  label?: string
  /** Accessible name for the idle button when the label alone is ambiguous, e.g. "Copy node id". */
  ariaLabel?: string
  variant?: ButtonVariant
  className?: string
}

/** How long "copied" shows (the real dashboard's 1.5 s). */
const COPIED_MS = 1500

/**
 * Copy text through the site's useCopy (clipboard API). When the clipboard is unavailable, the
 * text appears in a read-only field that is focused and selected ("select to copy"), so it can
 * always be copied by hand. Nothing is positioned fixed and nothing leaves the page.
 */
export function CopyButton({ text, label = "copy", ariaLabel, variant = "default", className }: CopyButtonProps) {
  const { copy, copied } = useCopy(COPIED_MS)
  const [manual, setManual] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!manual) return
    area.current?.focus()
    area.current?.select()
  }, [manual])

  const onClick = async () => {
    const state = await copy(text)
    setManual(state !== "copied")
  }

  const done = () => {
    setManual(false)
    buttonRef.current?.focus()
  }

  return (
    <span className={cn("inline-flex max-w-full flex-col items-start gap-2", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        onClick={() => void onClick()}
        className={buttonClasses({ variant, size: "sm" })}
      >
        {copied ? "copied" : label}
      </button>
      <span role="status" className="sr-only">
        {copied ? "copied to clipboard" : ""}
      </span>
      {manual ? (
        <span className="flex w-64 max-w-full flex-col gap-1">
          <textarea
            ref={area}
            readOnly
            value={text}
            rows={Math.min(8, Math.max(2, text.split("\n").length))}
            aria-label="Select to copy"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation()
                done()
              }
            }}
            // 16 px below 768 px (no zoom on focus on a phone), then the small log size.
            className={cn(FIELD_CLASS, "resize-y leading-relaxed @min-[768px]:text-xs")}
          />
          <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            select to copy
            <button type="button" onClick={done} className={cn("min-h-11 px-2 hover:text-foreground", FOCUS_RING)}>
              [done]
            </button>
          </span>
        </span>
      ) : null}
    </span>
  )
}
