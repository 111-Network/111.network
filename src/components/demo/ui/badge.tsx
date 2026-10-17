import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

/** Props of Badge: any span attributes. */
export type BadgeProps = HTMLAttributes<HTMLSpanElement>

/** Bordered tag (DESIGN.md "Badge / Tag"), e.g. the node chip's `LAPTOP`. Plain words, never codes. Server-safe. */
export function Badge({ className, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn("border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground", className)}
    />
  )
}
