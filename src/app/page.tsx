import { DemoCtaBand } from "@/components/frame/demo-cta-band"
import { Footer } from "@/components/frame/footer"
import { Hero } from "@/components/frame/hero"
import { Navigation } from "@/components/frame/navigation"
import { Terminal } from "@/components/frame/terminal"
import { Ticker } from "@/components/frame/ticker"
import { Layer0 } from "@/components/sections/layer-0"
import { Layer1 } from "@/components/sections/layer-1"
import { Layer2 } from "@/components/sections/layer-2"
import { Layer3 } from "@/components/sections/layer-3"
import { Layer4 } from "@/components/sections/layer-4"
import { Layer5 } from "@/components/sections/layer-5"
import { Layer6 } from "@/components/sections/layer-6"
import { Layer7 } from "@/components/sections/layer-7"
import { Layer8 } from "@/components/sections/layer-8"
import { Layer9 } from "@/components/sections/layer-9"

// Written once in P0 (plan §8); P5 moved the demo CTA band below the terminal.
// Sections and frame pieces change inside their own files.
export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <main id="main">
        <Hero />
        <Ticker />
        <Layer0 />
        <Layer1 />
        <Layer2 />
        <Layer3 />
        <Layer4 />
        <Layer5 />
        <Layer6 />
        <Layer7 />
        <Layer8 />
        <Layer9 />
        <Terminal />
        {/* The closing demo CTA sits at the very end of the page (owner, 2026-10-17). */}
        <DemoCtaBand />
      </main>

      <Footer />
    </div>
  )
}
