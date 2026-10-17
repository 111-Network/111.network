// A heading that can take the focus when a step swaps the controls under it (DEMO-CONTRACT §4
// "Focus on step changes"). Level from the shell, never a literal; tabIndex -1 so a script can focus
// it without adding a tab stop (globals.css hides that outline).
import { useEffect, useRef, type ReactNode, type Ref, type RefObject } from "react"
import { cn } from "@/lib/utils"
import { useShellMain } from "../../../shell/context"
import { scrollWithin } from "../../../shell/scroll"
import type { HeadingLevel } from "../../../ui/heading"

export interface FocusHeadingProps {
  level: HeadingLevel
  headingRef?: Ref<HTMLHeadingElement>
  className?: string
  children: ReactNode
}

export function FocusHeading({ level, headingRef, className, children }: FocusHeadingProps) {
  const Tag = `h${level}` as const
  return (
    <Tag ref={headingRef} tabIndex={-1} className={cn("font-mono text-sm leading-relaxed text-foreground", className)}>
      {children}
    </Tag>
  )
}

/**
 * When `key` changes (a new step or phase), move the focus to `target`, but only if the control that
 * had it is gone (the focus fell back to the page body). A person reading elsewhere keeps their place,
 * and the first render never moves anything. The heading is focused without scrolling the page; main
 * scrolls to it only when it is out of view (shell/scroll, never scrollIntoView).
 */
export function useStepFocus(key: string, target: RefObject<HTMLElement | null>): void {
  const main = useShellMain()
  const last = useRef(key)
  useEffect(() => {
    if (last.current === key) return
    last.current = key
    const el = target.current
    const doc = el?.ownerDocument
    if (!el || !doc) return
    const active = doc.activeElement
    if (active !== null && active !== doc.body) return
    el.focus({ preventScroll: true })
    const box = main.current
    if (!box || !box.contains(el)) return
    const r = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    if (r.top < b.top || r.bottom > b.bottom) scrollWithin(box, el)
  }, [key, target, main])
}
