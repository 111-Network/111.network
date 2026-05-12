"use client"

import { motion } from "framer-motion"

const TECH_ITEMS = [
  "Mesh Network",
  "P2P",
  "End-to-End Encryption",
  "Store & Forward",
  "Offline First",
  "Radio",
  "Satellite",
  "Open Source",
  "Cross-Platform",
  "No Internet Required",
  "Anonymous",
  "Decentralized",
  "Community Built",
  "Global Reach",
  "Resilient",
]

export function TechTicker() {
  return (
    <div className="overflow-hidden border-y border-border py-3" aria-label="Technology stack ticker">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          duration: 30,
          ease: "linear",
          repeat: Infinity,
        }}
      >
        {[...TECH_ITEMS, ...TECH_ITEMS].map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="font-mono text-xs text-muted-foreground"
          >
            {item}
            <span className="ml-8 text-border">{"///"}</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}
