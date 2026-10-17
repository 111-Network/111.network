import { describe, expect, it } from "vitest"
import { createRng, hashSeed, int, mulberry32, pick, shuffle } from "@/lib/prng"

describe("prng", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
    const s1 = createRng("hero")
    const s2 = createRng(hashSeed("hero"))
    expect(s1()).toBe(s2())
  })

  it("returns floats in [0, 1)", () => {
    const rng = createRng(1)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it("int is inclusive and in range", () => {
    const rng = createRng(2)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const v = int(rng, 3, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6])
  })

  it("pick returns members and rejects empty lists", () => {
    const rng = createRng(3)
    const items = ["a", "b", "c"] as const
    for (let i = 0; i < 50; i++) expect(items).toContain(pick(rng, items))
    expect(() => pick(rng, [])).toThrow()
  })

  it("shuffle is a permutation and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(createRng(4), input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out].sort((x, y) => x - y)).toEqual(input)
    expect(shuffle(createRng(4), input)).toEqual(out)
  })

  it("hashSeed gives unsigned 32-bit values", () => {
    for (const w of ["", "a", "layer-9", "a much longer seed string"]) {
      const h = hashSeed(w)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(2 ** 32)
    }
  })
})
