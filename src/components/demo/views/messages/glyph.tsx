// The delivery-evidence glyph (real views/messages/glyph.tsx; os/5-messaging/README.md §9): three pips
// after the outbox, filled as far as the evidence got. Shape and the word carry the state, never
// colour. The pips are CSS squares (the body font has no ■ □): filled = bg-foreground, empty =
// hollow border. A pip fills with a short colour transition only when a scheduled step lands (a
// response to a send); under reduced motion it changes at once. Delivery pips are never status dots.
import { cn } from "@/lib/utils"
import { MESSAGES_COPY } from "../../copy/messages"
import type { DeliveryState } from "../../engine/slices/messages"
import { glyphFor, messageStateCopy } from "./model"

const PIPS = [0, 1, 2] as const

export function StateGlyph({ state, cancelled = false, className }: { state: DeliveryState; cancelled?: boolean; className?: string }) {
  const g = glyphFor(state)
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground", className)}
      title={messageStateCopy({ state, cancelled })}
      data-state={cancelled ? "cancelled" : state}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {PIPS.map((i) => (
          <span
            key={i}
            className={cn(
              "inline-block h-2 w-2 border transition-colors duration-300 motion-reduce:transition-none",
              cancelled ? "border-muted-foreground" : "border-foreground",
              !cancelled && i < g.filled ? "bg-foreground" : "bg-transparent",
            )}
          />
        ))}
      </span>
      <span className="text-foreground">{cancelled ? MESSAGES_COPY.cancelledLabel : g.label}</span>
    </span>
  )
}
