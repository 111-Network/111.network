"use client"

import { Panel } from "@/components/common/panel"
import { useDevice } from "@/lib/device-store"
import { deviceById, type DeviceId } from "@/lib/devices"
import { cn } from "@/lib/utils"
import { HUB_SHELF } from "./copy"

/** Only a home server hosts the big libraries; every other device asks a nearby hub. */
function shelfCaption(device: DeviceId): string {
  if (device === "home-server") return "This home server hosts the big libraries for the devices around it."
  if (device === "radio-relay") return "Kept on hubs. A radio relay forwards without keeping."
  return `Kept on a nearby hub: this ${deviceById(device).label} asks for what it needs.`
}

/**
 * The hub shelf: maps · encyclopedias · updates · patches. Solid inverted =
 * hosted here (home server), dashed = ask a nearby hub. Follows the
 * page-level device. Volumes are CSS shapes, never status dots.
 */
export function HubShelf() {
  const device = useDevice()
  const hosted = device === "home-server"
  const where = hosted ? "hosted here" : "ask a nearby hub"

  return (
    <Panel className="flex h-full flex-col p-4 md:p-6">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hub shelf</h3>
      <ul aria-label="Big shared libraries" className="mt-4 grid grid-cols-4 gap-2 border-b-2 border-foreground pb-1">
        {HUB_SHELF.map((volume) => (
          <li
            key={volume}
            className={cn(
              "flex h-32 items-end justify-center px-1 py-3 transition-colors duration-200 motion-reduce:transition-none",
              hosted
                ? "bg-foreground text-background"
                : "border border-dashed border-muted-foreground text-muted-foreground",
            )}
          >
            <span className="rotate-180 font-mono text-[10px] uppercase tracking-widest [writing-mode:vertical-rl]">
              {volume}
            </span>
            <span className="sr-only">: {where}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] text-muted-foreground">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 bg-foreground" />
          hosted here (home server)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 border border-dashed border-muted-foreground" />
          ask a nearby hub
        </li>
      </ul>
      <p className="mt-4 font-mono text-xs leading-relaxed text-foreground">{shelfCaption(device)}</p>
    </Panel>
  )
}
