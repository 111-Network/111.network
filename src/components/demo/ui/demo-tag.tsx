import { cn } from "@/lib/utils"
import { DEMO_TAG_TEXT } from "./demo"

/** Props of DemoTag. */
export interface DemoTagProps {
  className?: string
}

/**
 * The small `DEMO` tag in front of a contextual demo action (plan §6.3). It takes the colour of
 * the text around it (`border-current`), so it reads on an outline button, on its hover and on an
 * inverted one. It is part of the accessible name: "DEMO plug in a radio board". Server-safe.
 */
export function DemoTag({ className }: DemoTagProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border border-current px-1 py-0.5 font-mono text-[10px] leading-none tracking-widest",
        className,
      )}
    >
      {DEMO_TAG_TEXT}
    </span>
  )
}
