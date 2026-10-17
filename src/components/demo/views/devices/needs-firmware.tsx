// The "NEEDS FIRMWARE" text tag beside a board's dot (real views/devices/needs-firmware.tsx). Text only: no new colour.
import { cn } from "@/lib/utils"
import { DEVICES_COPY } from "../../copy/devices"

export function NeedsFirmwareTag({ className }: { className?: string }) {
  return <span className={cn("shrink-0 font-mono text-[10px] uppercase tracking-widest text-foreground", className)}>{DEVICES_COPY.detail.needsFirmware}</span>
}
