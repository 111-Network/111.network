// Focus on step changes (DEMO-CONTRACT §4): when a click in a panel swaps its controls (the clicked
// button disappears, the next one appears after a scheduled step), focus moves to the panel's next
// working control, or to its heading while there is none yet. It moves only after the visitor acted
// in that panel (call `armed()` in the handler), never on a step nobody clicked for, and never
// away from a control the visitor moved to on their own. Refs are touched in effects and handlers only.
import { useCallback, useEffect, useRef, type RefObject } from "react"

/** Marks the panel's heading (tabIndex -1) and its step controls for the hook. */
export const FOCUS_HEADING = "data-focus-heading"
export const FOCUS_ACTION = "data-focus-action"

export function useStepFocus(root: RefObject<HTMLElement | null>, stageKey: string): () => void {
  const wanted = useRef(false)
  const lastKey = useRef(stageKey)

  useEffect(() => {
    if (lastKey.current === stageKey) return
    lastKey.current = stageKey
    const el = root.current
    if (!wanted.current || el === null) return
    const heading = el.querySelector<HTMLElement>(`[${FOCUS_HEADING}]`)
    const active = document.activeElement
    const lost = active === null || active === document.body || !active.isConnected
    if (!lost && active !== heading && !el.contains(active)) {
      wanted.current = false // the visitor went elsewhere
      return
    }
    if (!lost && active !== heading) return // focus is still on a control here
    const action = el.querySelector<HTMLElement>(`[${FOCUS_ACTION}]:not([aria-disabled="true"])`)
    if (action) {
      action.focus()
      wanted.current = false
    } else if (lost) heading?.focus()
  }, [root, stageKey])

  return useCallback(() => {
    wanted.current = true
  }, [])
}
