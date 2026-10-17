"use client"

import { stripCells } from "@/components/sections/layer-1/model"
import { SupportMark } from "@/components/sections/layer-1/support-mark"
import { useDevice } from "@/lib/device-store"
import { SUPPORT_LABELS, deviceById } from "@/lib/devices"
import { cn } from "@/lib/utils"

/** The ten-cell layer strip for the followed device (runs / partly, or via a nearby node / not run). */
export function LayerStrip() {
  const device = useDevice()
  return (
    <ol
      aria-label={`Layers the ${deviceById(device).label} runs`}
      className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-10"
    >
      {stripCells(device).map((cell) => (
        <li
          key={cell.n}
          className={cn(
            "flex flex-col gap-2 border border-border p-2.5 transition-colors duration-200",
            // Not-run cells read quieter, but at full muted contrast (AA); the hollow mark and the words carry the state.
            cell.support === "none" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          <span className="flex items-start justify-between gap-2">
            <span className="font-mono text-base leading-none font-bold">
              <span className="sr-only">Layer </span>
              {cell.n}
            </span>
            <SupportMark support={cell.support} />
          </span>
          <span className="break-words font-mono text-[10px] uppercase tracking-wider">{cell.name}</span>
          <span className="font-mono text-[10px] leading-snug text-muted-foreground">{SUPPORT_LABELS[cell.support]}</span>
        </li>
      ))}
    </ol>
  )
}
