import type { HTMLAttributes } from "react"

/** A heading level. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/** `n` clamped to a real heading level (1..6). */
export function clampHeading(n: number): HeadingLevel {
  return Math.min(6, Math.max(1, Math.round(n))) as HeadingLevel
}

/** Props of Heading: any heading attributes plus the level. */
export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: HeadingLevel
}

/**
 * h1..h6 by level. Views take the level from the shell (`useHeadingLevel()`), never a literal: a
 * view title is h1 on /demo and h3 inside the Layer 4 window on the home page. Server-safe.
 */
export function Heading({ level, ...rest }: HeadingProps) {
  const Tag = `h${level}` as const
  return <Tag {...rest} />
}
