import { cn } from "@/lib/utils"
import { keyBars, type KeyId } from "./model"

// No hooks and no "use client": rendered on the server inside the card fields
// and on the client inside the peer panel.

/** Props of KeyBars. */
export interface KeyBarsProps {
  keyId: KeyId
  /** Accessible name, e.g. "public half: the node's own key". */
  label: string
  className?: string
}

/** A key's public half drawn as a deterministic bar strip (CSS bars, no glyphs, never hex). */
export function KeyBars({ keyId, label, className }: KeyBarsProps) {
  return (
    <span role="img" aria-label={label} className={cn("inline-flex h-5 shrink-0 items-stretch", className)}>
      {keyBars(keyId).map((bar, i) => (
        <span key={i} className="bg-foreground" style={{ width: bar.width, marginRight: bar.gap }} />
      ))}
    </span>
  )
}
