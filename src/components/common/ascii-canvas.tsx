"use client"

import { useState } from "react"
import { motion } from "framer-motion"

/** Props of AsciiCanvas. */
interface AsciiCanvasProps {
  /** The drawing, printed in a <pre>. */
  art: string
  /** Accessible description of the drawing (role="img"). */
  label: string
  /** Header caption. Default "ASCII Schematic". */
  caption?: string
}

/** A bordered ASCII drawing with a caption; brightens on hover. */
export function AsciiCanvas({ art, label, caption = "ASCII Schematic" }: AsciiCanvasProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      className="relative overflow-hidden border border-border bg-secondary/30 p-4 transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileTap={{ scale: 0.98 }}
      role="img"
      aria-label={label}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="h-1.5 w-1.5 bg-foreground" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {caption}
        </span>
      </div>
      <pre
        className={`overflow-x-auto font-mono text-[9px] leading-[12px] transition-opacity duration-300 md:text-[11px] md:leading-[14px] ${
          isHovered ? "text-foreground opacity-100" : "text-foreground/80 opacity-80"
        }`}
      >
        {art}
      </pre>
      <span className="sr-only">{label}</span>
    </motion.div>
  )
}
