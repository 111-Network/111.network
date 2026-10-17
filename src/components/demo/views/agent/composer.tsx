// The input row (real views/agent/composer.tsx): `>` glyph, a textarea that grows with its text
// (CSS field-sizing, capped), and one send / stop button. The text lives in the agent slice, so it
// survives leaving the page; text put in the box for the user (starter, Why?, prefill) focuses it
// with the caret at the end. Nothing here ever sends by itself.
import { memo, useEffect, useId, useRef, type RefObject } from "react"
import { cn } from "@/lib/utils"
import { AGENT_COPY } from "../../copy/agent"
import { useDemo, useDispatch } from "../../engine/react"
import { Button } from "../../ui/button"
import { FIELD_CLASS } from "../../ui/classes"
import { selectDraft, selectStaged, selectStreaming } from "./select"

/** Longest message the box takes. */
export const AGENT_MAX_CHARS = 2000

const C = AGENT_COPY.composer

/** Focus the box with the caret after its text. Handlers and effects only. */
export function focusEnd(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.focus()
  const n = el.value.length
  el.setSelectionRange(n, n)
}

export interface ComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>
  onSend: (text: string) => void
  onStop: () => void
}

export const Composer = memo(function Composer({ inputRef, onSend, onStop }: ComposerProps) {
  const dispatch = useDispatch()
  const draft = useDemo(selectDraft)
  const staged = useDemo(selectStaged)
  const streaming = useDemo(selectStreaming)
  const hintId = useId()

  // Text handed over by the session after mount: show it, focus the box. Never sent from here.
  const seen = useRef(staged)
  useEffect(() => {
    if (seen.current === staged) return
    seen.current = staged
    focusEnd(inputRef.current)
  }, [staged, inputRef])

  const empty = draft.trim() === ""
  const submit = () => {
    if (streaming || empty) return
    onSend(draft)
  }

  return (
    <form
      className="flex shrink-0 items-end gap-2 border-t border-border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <span aria-hidden="true" className="flex min-h-11 select-none items-center text-sm text-muted-foreground">
        {">"}
      </span>
      <textarea
        ref={inputRef}
        rows={1}
        value={draft}
        maxLength={AGENT_MAX_CHARS}
        aria-label={C.label}
        aria-describedby={hintId}
        placeholder={C.placeholder}
        autoComplete="off"
        className={cn(FIELD_CLASS, "field-sizing-content max-h-36 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto")}
        onChange={(e) => dispatch({ type: "agent/draft", text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return
          e.preventDefault()
          submit()
        }}
      />
      {/* One button, two jobs: a swapped element would lose the keyboard user's focus. */}
      <Button
        type={streaming ? "button" : "submit"}
        size="sm"
        variant={streaming ? "default" : "primary"}
        aria-disabled={!streaming && empty ? true : undefined}
        onClick={streaming ? onStop : undefined}
      >
        {streaming ? C.stop : C.send}
      </Button>
      <span id={hintId} className="sr-only">
        {C.hint}
      </span>
    </form>
  )
})
