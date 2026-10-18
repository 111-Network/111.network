// Attention-badge model (React-free). Real source: os/40-interface/ui/src/components/attention-badge.tsx.

/** Screen-reader text for the count. */
export function attentionLabel(count: number): string {
  return count === 1 ? "1 item needs you" : `${count} items need you`
}

/** The count the badge shows, or null when it renders nothing (0, negative or not a number). */
export function attentionCount(count: number): number | null {
  if (!Number.isFinite(count) || count <= 0) return null
  return Math.floor(count) || null
}

/** Visible text: the count, capped at "99+". */
export function attentionText(n: number): string {
  return n > 99 ? "99+" : String(n)
}
