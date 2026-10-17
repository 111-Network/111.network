"use client"

import { useEffect, useRef, useState } from "react"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { createRng } from "@/lib/prng"
import { cn } from "@/lib/utils"
import type { ScopeMode } from "./model"
import { CARRIER_START, drawScope, tickCarrier, type CarrierClock } from "./scope-draw"

interface CanvasSize {
  w: number
  h: number
  dpr: number
}

/** Props of Scope. */
export interface ScopeProps {
  mode: ScopeMode
  /** Heartbeats sent so far; each new one sends a burst across the carrier. */
  beats: number
  /**
   * The mode moves and motion is allowed (the caller passes true only during a
   * seek, without reduced motion). The loop also needs the canvas itself on screen.
   */
  animate: boolean
  /** aria-label of the drawing, updated with the state. */
  label: string
  className?: string
}

/**
 * The seek readout window: a canvas sized by devicePixelRatio through a
 * ResizeObserver. One requestAnimationFrame loop while `animate` and the canvas
 * is in view; otherwise a single static frame of the current mode. The carrier
 * runs on one continuous clock, so heartbeats never make it jump, and the
 * settled frame freezes on the phase it last showed.
 */
export function Scope({ mode, beats, animate, label, className }: ScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inView = useInViewPlay(canvasRef)
  const clockRef = useRef<CarrierClock>(CARRIER_START)
  const [size, setSize] = useState<CanvasSize | null>(null)
  const running = animate && inView

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      const next: CanvasSize = {
        w: Math.round(box.width),
        h: Math.round(box.height),
        dpr: Math.min(window.devicePixelRatio || 1, 3),
      }
      setSize((prev) => (prev && prev.w === next.w && prev.h === next.h && prev.dpr === next.dpr ? prev : next))
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size || size.w === 0 || size.h === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    // Anything but a carrier (a new seek, standing by, a flat line) starts the carrier clock over.
    if (mode !== "carrier" && mode !== "settled") clockRef.current = CARRIER_START
    const rng = createRng(`l6-scope-${mode}-${beats}`)
    if (!running) {
      // One static frame; a settled carrier stops on its last phase, without a burst.
      drawScope(ctx, size.w, size.h, mode, clockRef.current.t, rng, null)
      return
    }
    let raf = 0
    let prev: number | null = null
    let noiseT = 0
    const frame = (now: number) => {
      const dt = prev === null ? 0 : (now - prev) / 1000
      prev = now
      if (mode === "carrier") {
        const clock = tickCarrier(clockRef.current, dt, beats)
        clockRef.current = clock
        drawScope(ctx, size.w, size.h, mode, clock.t, rng, clock.beatT)
      } else {
        noiseT += dt
        drawScope(ctx, size.w, size.h, mode, noiseT, rng, null)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [mode, beats, running, size])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      width={size ? Math.round(size.w * size.dpr) : undefined}
      height={size ? Math.round(size.h * size.dpr) : undefined}
      className={cn("block h-40 w-full bg-background md:h-48", className)}
    />
  )
}
