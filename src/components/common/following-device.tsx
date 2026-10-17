"use client"

import { useDevice } from "@/lib/device-store"
import { deviceById } from "@/lib/devices"
import { cn } from "@/lib/utils"

/** The quiet "following: old phone · change" line; "change" jumps to the L1 device chips. */
export function FollowingDevice({ className }: { className?: string }) {
  const device = deviceById(useDevice())
  return (
    <p className={cn("font-mono text-[10px] tracking-wider text-muted-foreground", className)}>
      following: <span className="text-foreground">{device.label}</span>
      <span aria-hidden="true"> · </span>
      <a
        href="#layer-1"
        className="underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
      >
        change<span className="sr-only"> the device you follow</span>
      </a>
    </p>
  )
}
