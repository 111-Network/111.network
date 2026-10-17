// The service's sample log (real views/services/log.tsx LogTail). The real one polls the node's log file;
// here the lines come from the demo store (engine/slices/services.ts): a short sample history, then one
// line per caused change. Rendered whole by MiniTerminal (no typewriter); nothing is added while idle.
import { useMemo } from "react"
import { SERVICES_COPY } from "../../../copy/services"
import type { ServiceLogLine } from "../../../engine/slices/services"
import type { UiMode } from "../../../engine/types"
import { MiniTerminal } from "../../../ui/mini-terminal"
import { LOG_LINES, logText } from "./model"

export interface ServiceLogProps {
  /** The service's plain name: the chrome reads "Mesh link ~ demo log". */
  name: string
  lines: readonly ServiceLogLine[]
  mode: UiMode
  /** The tail is being fed (the service is STARTING after a click): the block cursor blinks. */
  live: boolean
}

export function ServiceLog({ name, lines, mode, live }: ServiceLogProps) {
  const limit = LOG_LINES[mode]
  const shown = useMemo(() => logText(lines, limit), [lines, limit])
  return (
    <div className="space-y-2">
      <MiniTerminal title={name} suffix={SERVICES_COPY.log.suffix} lines={shown} follow live={live} maxHeightClass={mode === "advanced" ? "max-h-96" : "max-h-64"} />
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{SERVICES_COPY.log.note}</p>
    </div>
  )
}
