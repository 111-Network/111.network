import type { Rng } from "@/lib/prng"
import type { ScopeMode } from "./model"

// The seek readout (the V7 oscilloscope, ported): scanlines, an 8 × 4 grid and
// one trace. Pure maths plus one draw call, React-free. Drawn in CSS pixels;
// the caller scales the context by devicePixelRatio. No shadowBlur.

const TAU = Math.PI * 2

/** Points along the trace. */
export const SCOPE_POINTS = 120
/** How long one heartbeat burst takes to cross the window, in seconds. */
export const PULSE_SECONDS = 0.6

/** A heartbeat burst crossing left to right, `t` seconds after the beat; 0 outside its window. */
export function heartbeatPulse(u: number, t: number): number {
  if (t <= 0 || t >= PULSE_SECONDS) return 0
  const centre = t / PULSE_SECONDS
  const d = (u - centre) / 0.05
  return Math.exp(-d * d) * Math.sin(u * TAU * 30) * 0.5
}

/**
 * The carrier's clock: one continuous phase for a whole carrier run, kept
 * across frames, heartbeats, pauses and redraws. A new heartbeat restarts only
 * its burst, never the carrier.
 */
export interface CarrierClock {
  /** Carrier phase time, in seconds. */
  t: number
  /** The heartbeat count the burst belongs to. */
  beat: number
  /** Seconds since that heartbeat was first drawn, or null before the first one. */
  beatT: number | null
}

/** A fresh carrier run. */
export const CARRIER_START: CarrierClock = { t: 0, beat: 0, beatT: null }

/** Longest step one frame may take, so a stalled frame never makes the carrier jump. */
export const MAX_FRAME_SECONDS = 0.1

/** Advance the carrier clock by `dt` seconds with `beats` heartbeats sent so far. */
export function tickCarrier(clock: CarrierClock, dt: number, beats: number): CarrierClock {
  const step = Math.min(Math.max(dt, 0), MAX_FRAME_SECONDS)
  const t = clock.t + step
  if (beats !== clock.beat) return { t, beat: beats, beatT: beats > 0 ? 0 : null }
  return { t, beat: beats, beatT: clock.beatT === null ? null : clock.beatT + step }
}

/** The clean carrier at position `u` and carrier phase time `t` (seconds on one continuous clock). */
export function carrierY(u: number, t: number): number {
  return Math.sin(u * TAU * 4 - t * 5) * 0.4
}

/**
 * Trace height in [-1, 1] at position `u` (0..1 across the window) and time
 * `t` (seconds; for the carrier, one clock that runs through every heartbeat).
 * `beatT` is the time since the latest heartbeat, or null for none: it adds
 * the burst on top of the carrier. The settled frame freezes the carrier at
 * `t`, so it stops on the phase it last showed.
 */
export function traceY(mode: ScopeMode, u: number, t: number, rng: Rng, beatT: number | null): number {
  switch (mode) {
    case "idle":
    case "flat":
      return 0
    case "noise":
      return (rng() * 2 - 1) * 0.6 + Math.sin(u * TAU * 17 + t * 11) * 0.15
    case "carrier":
      return carrierY(u, t) + (beatT === null ? 0 : heartbeatPulse(u, beatT))
    case "settled":
      return carrierY(u, t)
  }
}

/** Draw one frame into a `w` × `h` (CSS px) context. */
export function drawScope(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: ScopeMode,
  t: number,
  rng: Rng,
  beatT: number | null,
): void {
  ctx.clearRect(0, 0, w, h)

  // Scanlines.
  ctx.lineWidth = 1
  ctx.strokeStyle = "rgba(255,255,255,0.03)"
  ctx.beginPath()
  for (let y = 0.5; y < h; y += 4) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()

  // Grid.
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.beginPath()
  for (let i = 0; i <= 8; i++) {
    const x = Math.min(Math.round((w / 8) * i) + 0.5, w - 0.5)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let i = 0; i <= 4; i++) {
    const y = Math.min(Math.round((h / 4) * i) + 0.5, h - 0.5)
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()

  // Trace.
  const mid = h / 2
  const amp = h * 0.4
  ctx.lineWidth = 2
  ctx.strokeStyle = mode === "idle" ? "rgba(255,255,255,0.3)" : mode === "flat" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.9)"
  ctx.beginPath()
  for (let i = 0; i <= SCOPE_POINTS; i++) {
    const u = i / SCOPE_POINTS
    const x = u * w
    const y = mid - traceY(mode, u, t, rng, beatT) * amp
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}
