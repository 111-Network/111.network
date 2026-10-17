"use client"

import { deviceFacts } from "@/components/sections/layer-1/model"
import { useDevice } from "@/lib/device-store"

/**
 * V3's "> label: value" lines for the followed device: what the installer
 * reads and works out (has, can be, the lighter jobs its parts allow, and the
 * gateway it can become while online). Swaps at once on a chip click, so the
 * small box shows its radio + hotspot Wi-Fi before its log reaches the bridge line.
 */
export function DeviceFacts() {
  const device = useDevice()
  return (
    <dl className="flex flex-col gap-3 p-4 font-mono text-xs leading-relaxed sm:px-6">
      {deviceFacts(device).map((fact) => (
        <div key={fact.label}>
          <dt className="inline text-muted-foreground">
            <span aria-hidden="true">{"> "}</span>
            {fact.label}:{" "}
          </dt>
          <dd className="inline font-bold text-foreground">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}
