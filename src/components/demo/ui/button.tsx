"use client"

import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { ARROW_CLASS, buttonClasses, showsArrow, type ButtonSize, type ButtonVariant } from "./button-classes"

export type { ButtonSize, ButtonVariant } from "./button-classes"

/** Props of Button: any button attributes plus the options below. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /**
   * Inline two-step confirmation, never a modal. The first click swaps the button for
   * "{confirm}? [Yes] [No]" in place (focus lands on No, Escape cancels). `onClick` fires on Yes only.
   */
  confirm?: string
  /**
   * Shows a blinking block cursor and ignores clicks. The button is marked `aria-disabled`, not
   * `disabled`: a disabled button cannot hold focus, so a keyboard user would be thrown to the page
   * body every time an action starts. The same goes for `aria-disabled` passed in directly.
   */
  loading?: boolean
  /** Trailing `->`. Defaults to true for `primary`. */
  arrow?: boolean
}

/** The dashboard button (default / primary / destructive-text), with the inline two-step confirm. */
export function Button({
  variant = "default",
  size = "md",
  confirm,
  loading = false,
  arrow,
  type = "button",
  disabled,
  onClick,
  className,
  children,
  ...rest
}: ButtonProps) {
  const [asking, setAsking] = useState(false)
  const mainRef = useRef<HTMLButtonElement>(null)
  const noRef = useRef<HTMLButtonElement>(null)
  const wasAsking = useRef(false)
  const soft = loading || rest["aria-disabled"] === true || rest["aria-disabled"] === "true"
  const inert = !!disabled || soft

  // An action that starts (or a disable) while the question is open cancels it. Adjusted during
  // render (React's "state from props" pattern), so it never flashes back when the button frees up.
  if (asking && (inert || !confirm)) setAsking(false)
  const open = asking && !inert && !!confirm

  useEffect(() => {
    if (open) noRef.current?.focus()
    else if (wasAsking.current) mainRef.current?.focus()
    wasAsking.current = open
  }, [open])

  if (open) {
    return (
      <span
        role="group"
        aria-label={`Confirm: ${confirm}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            setAsking(false)
          }
        }}
        className={cn("inline-flex flex-wrap items-center gap-2 font-mono", size === "sm" ? "text-xs" : "text-sm", className)}
      >
        <span className="text-foreground">{confirm}?</span>
        <button
          type={type}
          className={buttonClasses({ variant, size: "sm" })}
          onClick={(e) => {
            setAsking(false)
            onClick?.(e)
          }}
        >
          Yes
        </button>
        <button ref={noRef} type="button" className={buttonClasses({ variant: "default", size: "sm" })} onClick={() => setAsking(false)}>
          No
        </button>
      </span>
    )
  }

  return (
    <button
      {...rest}
      ref={mainRef}
      // A confirmable submit button must not submit on the first click.
      type={confirm ? "button" : type}
      disabled={!!disabled}
      aria-disabled={soft || undefined}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (soft) {
          e.preventDefault() // no submit, no action; focus stays where it is
          return
        }
        if (confirm) setAsking(true)
        else onClick?.(e)
      }}
      className={buttonClasses({ variant, size, className })}
    >
      {children}
      {loading ? (
        <>
          <span aria-hidden="true" className="animate-blink">
            {"█"}
          </span>
          <span className="sr-only">working</span>
        </>
      ) : showsArrow(variant, arrow) ? (
        <span aria-hidden="true" className={ARROW_CLASS}>
          {"->"}
        </span>
      ) : null}
    </button>
  )
}
