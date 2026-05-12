"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useState } from "react"
import type { TechSection } from "@/lib/sections-data"

const shadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px"

/*
  SECTION 04: PRIVATE MESSAGES
  Style: Code editor / IDE aesthetic. Split pane with source code on the left
  and a live "transformation" view on the right. Each pipeline stage is a
  horizontal "tab" you can click. Syntax-highlighted monospace everywhere.
*/

const stages = [
  {
    name: "PLAIN",
    label: "Your Message",
    code: `Hey! Are you at the
community center today?
Want to sync messages.

-- sent via 111 Mesh`,
  },
  {
    name: "ENCRYPT",
    label: "Encrypted Packet",
    code: `[HEADER]
  from: id:7f3a...e1
  to:   id:9b2c...d4
  type: DM
  size: 42 bytes

[PAYLOAD]
  0x7A 0x3F 0xE1 0xB2 ...
  0xC8 0x91 0x4D 0x6A ...
  (NaCl box encryption)

[SIGNATURE]
  sig: 0xA4F...2E (valid)`,
  },
  {
    name: "ROUTE",
    label: "Route Selection",
    code: `Route Analysis
├─ You (id:7f3a...e1)
│  └─ range: 150m bluetooth
├─ Hop 1: id:a1b2...c3
│  └─ relay: phone + mesh radio
├─ Hop 2: id:d4e5...f6
│  └─ relay: wifi + satellite uplink
└─ Target: id:9b2c...d4
   └─ status: reachable (3 hops)

Path: secure, encrypted at every hop`,
  },
  {
    name: "DELIVER",
    label: "Delivery Path",
    code: `[07:42:13] Message queued at origin
[07:42:14] Encrypted with recipient pubkey
[07:42:15] Broadcast to nearby nodes
[07:42:18] Relayed via id:a1b2...c3
[07:42:22] Uplink to satellite node
[07:42:31] Downlinked to mesh segment
[07:42:35] Arrived at recipient region
[07:42:36] Delivered to id:9b2c...d4
[07:42:36] Recipient decrypted & read`,
  },
  {
    name: "READ",
    label: "Decrypted Read",
    code: `Hey! Are you at the
community center today?
Want to sync messages.

-- sent via 111 Mesh
-- received: 07:42:36
-- hops: 3
-- encryption: verified`,
  },
]

export function SectionCompiler({ section }: { section: TechSection }) {
  const [activeStage, setActiveStage] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  return (
    <div ref={ref} className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-32">
      {/* Header with ghost number */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12 flex items-end gap-6"
      >
        <span className="font-pixel-line text-7xl font-bold leading-none text-foreground/[0.08] md:text-9xl">
          {section.number}
        </span>
        <div className="flex-1 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{section.subtitle}</span>
          </div>
          <h2 className="mt-2 font-pixel-line text-3xl font-bold text-foreground md:text-5xl">
            {section.title}
          </h2>
          <p className="mt-4 max-w-2xl font-mono text-xs leading-relaxed text-muted-foreground">{section.description}</p>
        </div>
      </motion.div>

      {/* IDE-like panel */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="overflow-hidden border border-border"
        style={{ boxShadow: shadow }}
      >
        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-border">
          {stages.map((stage, i) => (
            <button
              key={stage.name}
              onClick={() => setActiveStage(i)}
              className={`flex items-center gap-2 border-r border-border px-5 py-3 font-mono text-xs transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none ${
                activeStage === i
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <span className="text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
              <span className="whitespace-nowrap">{stage.name}</span>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="grid lg:grid-cols-3">
          {/* Code pane (2 cols) */}
          <div className="border-b border-border lg:col-span-2 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {stages[activeStage].label}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Stage {activeStage + 1}/{stages.length}
              </span>
            </div>
            <motion.div
              key={activeStage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <pre className="overflow-x-auto p-6 font-mono text-xs leading-relaxed text-foreground">
                {/* Line numbers */}
                <span className="select-none text-muted-foreground/40">
                  {stages[activeStage].code.split("\n").map((_, i) => (
                    <span key={i} className="mr-6 inline-block w-4 text-right">{i + 1}</span>
                  ))}
                </span>
                {"\n"}
                {stages[activeStage].code}
              </pre>
            </motion.div>
          </div>

          {/* Info pane */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <div className="h-1.5 w-1.5 bg-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Encryption Pipeline</span>
            </div>

            {/* Pipeline progress */}
            <div className="border-b border-border p-4">
              <div className="flex gap-1">
                {stages.map((_, i) => (
                  <motion.div
                    key={i}
                    className={`h-1.5 flex-1 ${i <= activeStage ? "bg-foreground" : "bg-border"}`}
                    initial={false}
                    animate={{ opacity: i <= activeStage ? 1 : 0.3 }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>Plain</span>
                <span>Secure</span>
              </div>
            </div>

            {/* Specs */}
            <div className="flex-1 p-4">
              <div className="flex flex-col gap-3">
                {section.specs.map((spec, i) => (
                  <div key={spec.label} className="flex flex-col gap-0.5 font-mono text-xs">
                    <span className="text-[10px] text-muted-foreground">{spec.label}</span>
                    <span className="font-bold text-foreground">{spec.value}</span>
                    {i < section.specs.length - 1 && <div className="mt-2 h-px bg-border" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
