import { cn } from "@/lib/utils"
import { attentionCount, attentionLabel, attentionText } from "./attention"

/** Props of AttentionBadge. */
export interface AttentionBadgeProps {
  count: number
  className?: string
}

/** Inverted count pill ("needs you"). Renders nothing at 0. Not a control, so no focus ring. Server-safe. */
export function AttentionBadge({ count, className }: AttentionBadgeProps) {
  const n = attentionCount(count)
  if (n === null) return null
  return (
    <span
      role="img"
      aria-label={attentionLabel(n)}
      className={cn(
        "inline-flex min-w-5 items-center justify-center border border-foreground bg-foreground px-1.5 py-0.5 font-mono text-[10px] leading-none text-background",
        className,
      )}
    >
      <span aria-hidden="true">{attentionText(n)}</span>
    </span>
  )
}
