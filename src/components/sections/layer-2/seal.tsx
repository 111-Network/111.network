import { cn } from "@/lib/utils"
import { SEAL_WORD, type SealState } from "./model"

// No hooks and no "use client": the card's static seal renders on the server
// (card-fields.tsx), the peer's changing reading on the client (identity-bench.tsx).

// Three shapes that stay apart at 16 px, not only by their word:
// VOUCHED is the inverted square with a dark core, WRONG KEY a plain hollow
// square, BROKEN a dashed one.
const BOX: Record<SealState, string> = {
  vouched: "bg-foreground",
  broken: "border border-dashed border-foreground",
  "wrong-key": "border border-foreground",
}

/** Props of Seal. */
export interface SealProps {
  state: SealState
  /** The word beside the square. Defaults to the peer's reading (VOUCHED / BROKEN / WRONG KEY). */
  word?: string
  className?: string
}

/**
 * The seal: a small inverted square + word. Not a status dot, and not L6's
 * border-2 stamp box. BROKEN plays the one-shot glitch on mount (off under
 * reduced motion); remount it to play again.
 */
export function Seal({ state, word, className }: SealProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", state === "broken" && "animate-glitch-once", className)}>
      <span aria-hidden="true" className={cn("flex h-4 w-4 shrink-0 items-center justify-center", BOX[state])}>
        {state === "vouched" ? <span className="h-1.5 w-1.5 bg-background" /> : null}
      </span>
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest">{word ?? SEAL_WORD[state]}</span>
    </span>
  )
}
