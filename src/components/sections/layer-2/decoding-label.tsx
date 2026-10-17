"use client"

import { useEffect, useRef, useState } from "react"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import {
  advanceDecode,
  DECODE_DONE,
  DECODE_IDLE,
  DECODE_INTERVAL_MS,
  decodeFrame,
  decodeTick,
  NODE_LABEL,
  type DecodeProgress,
} from "./model"

/** Props of DecodingLabel. */
export interface DecodingLabelProps {
  /** The bench's print counter: each new value decodes the label once from noise. */
  printRun: number
  className?: string
}

/**
 * The card's label. Right after a print it decodes from noise (the section's one
 * JS loop): an interval that runs only while the label itself is on screen, so
 * only this span re-renders per frame. Whole under reduced motion and on the server.
 */
export function DecodingLabel({ printRun, className }: DecodingLabelProps) {
  // Always mounted: the card stays in the DOM (clipped in the slot) before it prints.
  const ref = useRef<HTMLSpanElement>(null)
  const play = useInViewPlay(ref)
  const reduced = useReducedMotion()
  const [progress, setProgress] = useState<DecodeProgress>(DECODE_IDLE)

  const tick = decodeTick(printRun, progress)
  const decoding = !reduced && tick < DECODE_DONE

  useEffect(() => {
    if (!decoding || !play) return
    const id = window.setInterval(() => setProgress((p) => advanceDecode(p, printRun)), DECODE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [decoding, play, printRun])

  return (
    <span ref={ref} className={cn("block", className)}>
      <span aria-hidden="true">{decoding ? decodeFrame(NODE_LABEL, tick, printRun) : NODE_LABEL}</span>
      <span className="sr-only">{NODE_LABEL}</span>
    </span>
  )
}
