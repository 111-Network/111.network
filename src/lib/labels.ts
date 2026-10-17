import { createRng, type Rng } from "@/lib/prng"

// Display-only node labels (plan §4.4, L2): grouped, base32 alphabet a–z + 2–7,
// never hex. A label is never proof of identity.

/** The only characters a label may use. */
export const LABEL_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"

/** Shape of a grouped label, e.g. "k7m2-qx6d-4a". */
export const LABEL_PATTERN = /^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{2}$/

function chunk(rng: Rng, length: number): string {
  let out = ""
  for (let i = 0; i < length; i++) out += LABEL_ALPHABET[Math.floor(rng() * LABEL_ALPHABET.length)]
  return out
}

/** A deterministic grouped label such as "k7m2-qx6d-4a" for a seed (number or string). */
export function groupedLabel(seed: number | string): string {
  const rng = createRng(seed)
  return `${chunk(rng, 4)}-${chunk(rng, 4)}-${chunk(rng, 2)}`
}

/** True when `value` has the grouped-label shape. */
export function isGroupedLabel(value: string): boolean {
  return LABEL_PATTERN.test(value)
}
