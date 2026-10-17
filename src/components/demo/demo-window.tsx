"use client"

// The demo shell for the Layer 4 window on the home page (plan §5 L4, built in P5). It has its own
// store with the MEMORY router: it never reads or writes location.hash, never sets the document
// title and never touches localStorage. The layout is forced to the 56 px icon rail, so it does not
// measure itself either. Its links still carry real hrefs ("/demo#/nearby"): a modified click opens
// the full demo, a plain click navigates inside the window.
//
// Load it from a client wrapper with next/dynamic and `ssr: false`, once the section is in view:
//   const DemoWindow = dynamic(() => import("@/components/demo/demo-window").then((m) => m.DemoWindow), { ssr: false })
// and give it a fixed height (the shell fills its parent): <div className="h-[32rem]"><DemoWindow /></div>
import { cn } from "@/lib/utils"
import { DemoStoreProvider, useDemoStoreInstance } from "./engine/react"
import { DEFAULT_PATH } from "./engine/router"
import { DEMO_WORLD } from "./engine/world"
import { Shell } from "./shell/shell"

export interface DemoWindowProps {
  /** The first route inside the window (default "/overview"). */
  initialPath?: string
  className?: string
}

export function DemoWindow({ initialPath = DEFAULT_PATH, className }: DemoWindowProps) {
  const store = useDemoStoreInstance(DEMO_WORLD, { router: "memory", layout: "rail", initialPath })
  return (
    <DemoStoreProvider store={store}>
      <Shell className={cn("h-full", className)} />
    </DemoStoreProvider>
  )
}
