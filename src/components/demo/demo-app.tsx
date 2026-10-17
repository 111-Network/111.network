"use client"

// The /demo client island (plan §6.5): one store per mount (url router: it reads and writes
// location.hash; layout "auto": the shell measures its own root), and the shell. Until the store has
// started and read the hash, the shell renders its chrome with an empty main (the server snapshot has
// no route: the hash cannot be read on the server).
import { cn } from "@/lib/utils"
import { DemoStoreProvider, useDemoStoreInstance } from "./engine/react"
import { DEMO_WORLD } from "./engine/world"
import { DEMO_MAIN_ID } from "./shell/frame-ids"
import { Shell } from "./shell/shell"

export interface DemoAppProps {
  className?: string
}

export function DemoApp({ className }: DemoAppProps) {
  // createDemoStore touches window only in start(), which the provider calls in an effect.
  const store = useDemoStoreInstance(DEMO_WORLD, { router: "url", layout: "auto" })
  return (
    <DemoStoreProvider store={store}>
      {/* The page renders its own skip button above the site bar, so the shell's is off here. */}
      <Shell className={cn("min-h-0 flex-1", className)} mainId={DEMO_MAIN_ID} skipLink={false} />
    </DemoStoreProvider>
  )
}
