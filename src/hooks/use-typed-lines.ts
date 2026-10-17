import { useEffect, useState } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

/** Options for useTypedLines. */
export interface TypedLinesOptions {
  /** Type only while true (e.g. useInViewPlay(ref)); pausing keeps progress. */
  play: boolean
  /** Milliseconds per line. Default 150. */
  intervalMs?: number
  /** Change it (counter, device id, tab) to retype from the first line. Default 0. */
  runKey?: string | number
}

/** Result of useTypedLines. */
export interface TypedLines<T> {
  /** The lines printed so far (all of them under reduced motion). */
  visible: readonly T[]
  /** How many lines are printed. */
  count: number
  /** True once every line is printed. */
  done: boolean
  /** True while lines are still being typed (play && !done). */
  typing: boolean
}

interface Progress {
  key: string | number
  count: number
}

/**
 * Types `lines` one per `intervalMs` while `play` is true, restarts when `runKey`
 * changes, and prints everything at once under reduced motion.
 * Shared by the hero install run, the L1 boot log and the finale terminal.
 */
export function useTypedLines<T>(
  lines: readonly T[],
  { play, intervalMs = 150, runKey = 0 }: TypedLinesOptions,
): TypedLines<T> {
  const reduced = useReducedMotion()
  const [progress, setProgress] = useState<Progress>({ key: runKey, count: 0 })

  const total = lines.length
  const typed = progress.key === runKey ? Math.min(progress.count, total) : 0
  const count = reduced ? total : typed
  const done = count >= total

  useEffect(() => {
    if (!play || reduced || done) return
    const id = setInterval(() => {
      setProgress((prev) => {
        const from = prev.key === runKey ? prev.count : 0
        return { key: runKey, count: Math.min(from + 1, total) }
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [play, reduced, done, runKey, intervalMs, total])

  return {
    visible: count === total ? lines : lines.slice(0, count),
    count,
    done,
    typing: play && !done,
  }
}
