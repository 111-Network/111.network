"use client"

import { MotionConfig } from "framer-motion"
import type { ReactNode } from "react"

/** App-wide motion settings: every framer animation honours the OS reduced-motion setting. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
