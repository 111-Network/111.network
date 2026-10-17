"use client"

import { useRef, useState, type ReactNode } from "react"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { cn } from "@/lib/utils"

/** Props of TickerMarquee. */
export interface TickerMarqueeProps {
  /** Two identical copies of the item list, side by side (the track moves -50%). */
  children: ReactNode
  /** Seconds for one copy to scroll past. */
  durationS: number
  className?: string
}

/**
 * The moving strip of the ticker (plan §4.3). A CSS marquee, not a JS loop:
 * it runs only while the strip is on screen and the tab is visible
 * (useInViewPlay), stops while hovered, and the visitor can pause it with the
 * PAUSE button (WCAG 2.2.2). Under reduced motion the parent hides this strip
 * and shows a static wrapped list instead.
 */
export function TickerMarquee({ children, durationS, className }: TickerMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const inView = useInViewPlay(viewportRef)
  const [paused, setPaused] = useState(false)
  const running = inView && !paused

  return (
    <div className={cn("flex min-h-11 min-w-0 flex-1 items-stretch sm:min-h-0", className)}>
      <div ref={viewportRef} className="group flex min-w-0 flex-1 items-center overflow-hidden py-3">
        <div
          className={cn("flex w-max animate-marquee group-hover:animate-paused", !running && "animate-paused")}
          style={{ animationDuration: `${durationS}s` }}
        >
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        className="min-w-11 shrink-0 border-l border-border bg-background px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-inset focus-visible:outline-none"
      >
        {paused ? "Play" : "Pause"}
        <span className="sr-only"> the ticker</span>
      </button>
    </div>
  )
}
