"use client"

import { useEffect, useRef } from "react"
import { LAYERS } from "@/lib/layers"
import { cn } from "@/lib/utils"
import { READING_LINE, segmentFills } from "./nav-model"

/**
 * The 2 px, ten-segment depth strip on the header's bottom edge (plan §4.1).
 * Segment N fills as section layer-N passes the reading line. A passive scroll
 * listener schedules one rAF update; fills are written straight to the DOM (no
 * React state per frame). There is no transition, so under reduced motion
 * (instant scrolling) the strip simply jumps with the page.
 */
export function NavDepthStrip({ className }: { className?: string }) {
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const fills = Array.from(strip.querySelectorAll<HTMLElement>("[data-fill]"))
    const sections = LAYERS.map((layer) => document.getElementById(layer.id))
    const last = fills.map(() => -1)
    let raf = 0

    const update = () => {
      raf = 0
      const boxes = sections.map((el) => {
        if (!el) return null
        const rect = el.getBoundingClientRect()
        return { top: rect.top, height: rect.height }
      })
      const next = segmentFills(boxes, window.innerHeight * READING_LINE)
      next.forEach((value, i) => {
        const fill = fills[i]
        if (!fill || last[i] === value) return
        last[i] = value
        fill.style.transform = `scaleX(${value})`
      })
    }
    const schedule = () => {
      if (raf === 0) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule, { passive: true })
    // Sections that grow or shrink (open drawers, late fonts) move the others.
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule)
    resize?.observe(document.body)

    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      resize?.disconnect()
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={stripRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-0 bottom-0 flex h-0.5 gap-px", className)}
    >
      {LAYERS.map((layer) => (
        <span key={layer.id} className="relative flex-1 overflow-hidden bg-border">
          <span data-fill="" className="absolute inset-0 origin-left bg-foreground [transform:scaleX(0)]" />
        </span>
      ))}
    </div>
  )
}
