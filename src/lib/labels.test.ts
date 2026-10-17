import { describe, expect, it } from "vitest"
import { LABEL_ALPHABET, groupedLabel, isGroupedLabel } from "@/lib/labels"

const SHAPE = /^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{2}$/

describe("groupedLabel", () => {
  it("uses only the base32 alphabet a–z, 2–7, grouped 4-4-2", () => {
    for (let seed = 0; seed < 500; seed++) {
      const label = groupedLabel(seed)
      expect(label).toMatch(SHAPE)
      expect(isGroupedLabel(label)).toBe(true)
    }
    for (const word of ["workshop-laptop", "ada", "bram", ""]) expect(groupedLabel(word)).toMatch(SHAPE)
  })

  it("never looks like hex-only output", () => {
    const labels = Array.from({ length: 200 }, (_, i) => groupedLabel(i))
    expect(labels.some((l) => /[g-z]/.test(l))).toBe(true)
    expect(labels.every((l) => !/[0189]/.test(l))).toBe(true)
  })

  it("is deterministic per seed and varies across seeds", () => {
    expect(groupedLabel(42)).toBe(groupedLabel(42))
    expect(groupedLabel("node")).toBe(groupedLabel("node"))
    expect(new Set(Array.from({ length: 50 }, (_, i) => groupedLabel(i))).size).toBe(50)
  })

  it("exposes the 32-character alphabet", () => {
    expect(LABEL_ALPHABET).toHaveLength(32)
    expect(new Set(LABEL_ALPHABET).size).toBe(32)
    expect(isGroupedLabel("k7m2-qx6d-4a")).toBe(true)
    expect(isGroupedLabel("0x1f-ab89-cd")).toBe(false)
  })
})
