"use client"

import { ChipGroup, type ChipOption } from "@/components/common/chip-group"
import { setDevice, useDevice } from "@/lib/device-store"
import { DEVICES, type DeviceId } from "@/lib/devices"
import { cn } from "@/lib/utils"

const OPTIONS: readonly ChipOption<DeviceId>[] = DEVICES.map((d) => ({ value: d.id, label: d.label }))

/** Props of DeviceChips. */
export interface DeviceChipsProps {
  /** Hide the visible "device" caption (the radiogroup keeps its accessible name). */
  hideCaption?: boolean
  className?: string
}

/** The page-level device picker (W5 plain words); writes the shared store and `?device=`. */
export function DeviceChips({ hideCaption, className }: DeviceChipsProps) {
  const device = useDevice()
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!hideCaption && (
        <span aria-hidden="true" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          device
        </span>
      )}
      <ChipGroup aria-label="device" value={device} onValueChange={setDevice} options={OPTIONS} />
    </div>
  )
}
