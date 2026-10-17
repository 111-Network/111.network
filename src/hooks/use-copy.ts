import { useCallback, useEffect, useState } from "react"

/** "copied" = on the clipboard; "selected" = clipboard unavailable, the target's text is selected instead. */
export type CopyState = "idle" | "copied" | "selected"

/** Result of useCopy. */
export interface UseCopy {
  /** Copy `text`; if the clipboard is unavailable, select `fallbackTarget`'s text. Resolves to the new state. */
  copy: (text: string, fallbackTarget?: HTMLElement | null) => Promise<CopyState>
  /** True for `resetMs` after a successful copy. */
  copied: boolean
  /** Last outcome; returns to "idle" after `resetMs`. */
  state: CopyState
}

function selectText(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select()
    return true
  }
  const selection = window.getSelection()
  if (!selection) return false
  const range = document.createRange()
  range.selectNodeContents(el)
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}

/** Clipboard copy with a select-the-text fallback; `copied` auto-resets after `resetMs` (default 2000). */
export function useCopy(resetMs = 2000): UseCopy {
  // `n` makes every copy a new object, so a repeat copy restarts the reset timer.
  const [result, setResult] = useState<{ state: CopyState; n: number }>({ state: "idle", n: 0 })

  useEffect(() => {
    if (result.state === "idle") return
    const id = setTimeout(() => setResult((r) => ({ state: "idle", n: r.n })), resetMs)
    return () => clearTimeout(id)
  }, [result, resetMs])

  const copy = useCallback(async (text: string, fallbackTarget?: HTMLElement | null) => {
    let next: CopyState = "idle"
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable")
      }
      await navigator.clipboard.writeText(text)
      next = "copied"
    } catch {
      next = fallbackTarget && selectText(fallbackTarget) ? "selected" : "idle"
    }
    setResult((r) => ({ state: next, n: r.n + 1 }))
    return next
  }, [])

  return { copy, copied: result.state === "copied", state: result.state }
}
