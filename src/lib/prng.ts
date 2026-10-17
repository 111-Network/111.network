// Seeded PRNG for render-safe "random" data (plan §7: no Math.random in render
// paths). Same seed, same sequence, on the server and the client.

/** A generator returning floats in [0, 1). */
export type Rng = () => number

/** 32-bit seed from a string (FNV-1a), so seeds can be words like "hero-field". */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: a small, fast, seeded generator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seeded generator from a number or a string seed. */
export function createRng(seed: number | string): Rng {
  return mulberry32(typeof seed === "string" ? hashSeed(seed) : seed)
}

/** Integer in [min, max], both inclusive. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** One item of a non-empty list. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick: empty list")
  return items[Math.floor(rng() * items.length)]
}

/** A shuffled copy (Fisher-Yates); the input is not changed. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}
