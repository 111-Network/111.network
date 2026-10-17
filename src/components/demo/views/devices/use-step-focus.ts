// Focus on step changes (DEMO-CONTRACT §4): when a step swaps the controls of a panel, focus moves to
// the new step's lead element (a heading-like line with tabIndex -1, or its first control). As in the
// real flash panel's Outcome, it never pulls focus away from where the person is: it moves only when
// focus was lost with the old controls (it sits on the body) or is still inside the panel.
import { useEffect, useRef, type RefObject } from "react"

/** Mark the element a step leads with: `<p tabIndex={-1} {...STEP_FOCUS}>`. */
export const STEP_FOCUS = { "data-step-focus": "" } as const

/** Mark the element focus returns to when a step is cancelled (the button that opened it). */
export const STEP_RETURN = { "data-step-return": "" } as const

export interface StepFocusOptions {
  /** Also move focus when the panel first appears (it appeared because of a click elsewhere in the view). */
  onMount?: boolean
  /** Steps that, when left for the step before, hand focus back to the STEP_RETURN element. */
  returnFrom?: readonly string[]
}

export function useStepFocus<T extends HTMLElement>(step: string, opts: StepFocusOptions = {}): RefObject<T | null> {
  const ref = useRef<T>(null)
  const last = useRef<string | null>(null)
  const { onMount = false, returnFrom } = opts
  const returning = returnFrom?.join(" ") ?? ""
  useEffect(() => {
    const prev = last.current
    last.current = step
    if (prev === step || (prev === null && !onMount)) return
    const root = ref.current
    if (!root) return
    const doc = root.ownerDocument
    const active = doc.activeElement
    if (active !== null && active !== doc.body && !root.contains(active)) return
    const back = prev !== null && returning.split(" ").includes(prev)
    const target = root.querySelector<HTMLElement>(back ? "[data-step-return]" : "[data-step-focus]") ?? root.querySelector<HTMLElement>("[data-step-focus]")
    target?.focus()
  }, [step, onMount, returning])
  return ref
}
