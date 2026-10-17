import Link from "next/link"
import { getLayer, type LayerNumber } from "@/lib/layers"
import { DEMO_READY } from "@/lib/site"
import { cn } from "@/lib/utils"

/** "see it in the dashboard ->" deep link for layer `n`; renders nothing until DEMO_READY (plan §4.2). */
export function LayerFooter({ n, className }: { n: LayerNumber; className?: string }) {
  if (!DEMO_READY) return null
  const layer = getLayer(n)
  return (
    <div className={cn("mt-12 flex justify-end", className)}>
      <Link
        href={layer.demoHref}
        className="group inline-flex min-h-11 items-center gap-2 font-mono text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
      >
        see it in the dashboard
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
          {"->"}
        </span>
        <span className="sr-only">: {layer.title}</span>
      </Link>
    </div>
  )
}
