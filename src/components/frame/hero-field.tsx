"use client"

import { useEffect, useRef } from "react"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { createRng, type Rng } from "@/lib/prng"
import { FIELD_COLS, FIELD_FRAME_MS, FIELD_ROWS, fieldFrame } from "./hero-field-frame"

/**
 * The hero's ASCII background field and scanline (plan §2.1 V1).
 *
 * Frames are written straight into `pre.textContent` through a ref: no React
 * state per frame. The loop runs only while the field is on screen and the
 * tab is visible; under reduced motion it draws one static frame. Data comes
 * from the seeded generator (no Math.random), and the server renders an empty
 * field, so the random letters never reach the HTML.
 */
export function HeroField() {
  const fieldRef = useRef<HTMLDivElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const rngRef = useRef<Rng | null>(null)
  const inView = useInViewPlay(fieldRef)
  const reduced = useReducedMotion()
  const animate = inView && !reduced

  useEffect(() => {
    const pre = preRef.current
    if (!pre) return
    rngRef.current ??= createRng("hero-field")
    const rng = rngRef.current

    if (!animate) {
      // Static frame (first paint, reduced motion); a paused field keeps its last frame.
      if (!pre.textContent) pre.textContent = fieldFrame(rng, FIELD_ROWS, FIELD_COLS)
      return
    }

    let raf = 0
    let last = Number.NEGATIVE_INFINITY
    const tick = (time: number) => {
      if (time - last >= FIELD_FRAME_MS) {
        last = time
        pre.textContent = fieldFrame(rng, FIELD_ROWS, FIELD_COLS)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate])

  return (
    <>
      {/*
        The play state is inline on purpose: `.animate-scanline` is an unlayered
        rule whose `animation` shorthand resets the play state, so the layered
        `animate-paused` utility can never pause it; an inline style wins.
        inView is false on the server and during hydration, so the HTML says
        paused and the client matches.
      */}
      <div
        aria-hidden="true"
        className="animate-scanline pointer-events-none absolute inset-0 z-10 h-[2px] w-full bg-foreground/5 motion-reduce:hidden"
        style={{ animationPlayState: inView ? "running" : "paused" }}
      />
      <div
        ref={fieldRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.10]"
      >
        <pre ref={preRef} className="font-mono text-sm leading-[18px] text-foreground lg:text-base lg:leading-[22px]" />
      </div>
    </>
  )
}
