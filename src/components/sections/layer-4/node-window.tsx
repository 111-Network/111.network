"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { SimulationChip } from "@/components/common/simulation-chip"
import { observeInView } from "@/hooks/use-in-view-play"

/** Static stand-in of the same size, shown until the window's code has loaded (no motion). */
function WindowPlaceholder() {
  return (
    <div className="flex h-full">
      <div aria-hidden="true" className="w-14 shrink-0 border-r border-border" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-6">
        <p className="font-pixel-line text-lg text-foreground">Overview</p>
        <p className="font-mono text-xs text-muted-foreground">Opening your node…</p>
      </div>
    </div>
  )
}

// The real /demo shell (memory router, 56 px rail). next/dynamic with ssr: false keeps the demo
// engine out of the home page's first-load JS; it loads only when the window nears the viewport.
const DemoWindow = dynamic(() => import("@/components/demo/demo-window").then((m) => m.DemoWindow), {
  ssr: false,
  loading: () => <WindowPlaceholder />,
})

/**
 * Layer 4's faux browser window (plan §5 L4): the real /demo dashboard shell with its own store,
 * fully clickable, nothing autoplays. Mounted once the frame comes within 400 px of the viewport.
 */
export function NodeWindow() {
  const ref = useRef<HTMLDivElement>(null)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || armed) return
    return observeInView(
      el,
      (inView) => {
        if (inView) setArmed(true)
      },
      { rootMargin: "400px 0px" },
    )
  }, [armed])

  return (
    <div ref={ref} className="overflow-hidden border border-border bg-background shadow-panel">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span aria-hidden="true" className="flex shrink-0 gap-1.5">
          <span className="h-2 w-2 bg-foreground" />
          <span className="h-2 w-2 bg-muted-foreground/50" />
          <span className="h-2 w-2 bg-muted-foreground/30" />
        </span>
        <span className="min-w-0 flex-1 truncate border border-border px-3 py-1 font-mono text-[10px] text-muted-foreground">
          your node · opened in any browser · works with no internet
        </span>
        <SimulationChip className="shrink-0" />
      </div>
      <div className="h-[30rem] sm:h-[34rem]">{armed ? <DemoWindow /> : <WindowPlaceholder />}</div>
    </div>
  )
}
