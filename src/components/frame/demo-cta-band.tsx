import type { CSSProperties } from "react"
import Link from "next/link"
import { LAYERS } from "@/lib/layers"
import { ANCHORS, DEMO_PATH, DEMO_READY } from "@/lib/site"

/** Ring for controls on the white band: the colours swap (P0 contract). */
const FOCUS_ON_BAND =
  "focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-foreground focus-visible:outline-none"

/**
 * The closing "Now open the node." band at the very end of the page (plan §6.7, W12): a full-width
 * inverted band with the bold demo button and ten cells, one deep link per layer. Hovering the
 * button lights the ten cells once, in layer order (CSS only, no loop); renders nothing until
 * DEMO_READY.
 */
export function DemoCtaBand() {
  if (!DEMO_READY) return null
  return (
    <section aria-labelledby="demo-cta-title" className="border-b border-border bg-foreground text-background">
      <div className="group/cta mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
        <p className="font-mono text-[10px] uppercase tracking-widest text-background/60">Interactive demo</p>
        <h2 id="demo-cta-title" className="mt-3 font-pixel-line text-4xl font-bold tracking-tight md:text-6xl">
          Now open the node.
        </h2>
        <p className="mt-4 max-w-2xl font-mono text-sm leading-relaxed text-background/70">
          An interactive copy of the dashboard, with every layer in it. Sample data, and nothing leaves the page.
        </p>

        <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <Link
            href={`${DEMO_PATH}#/overview`}
            data-cta-primary=""
            className={`group/btn inline-flex min-h-14 items-center justify-center gap-3 border border-background bg-background px-8 py-4 font-mono text-base font-bold uppercase tracking-wider text-foreground transition-colors duration-200 hover:bg-transparent hover:text-background ${FOCUS_ON_BAND}`}
          >
            Open the demo
            <span aria-hidden="true" className="shrink-0 whitespace-nowrap transition-transform duration-200 group-hover/btn:translate-x-1 motion-reduce:transition-none">
              {"->"}
            </span>
          </Link>
          <a
            href={`#${ANCHORS.install}`}
            className={`inline-flex min-h-11 items-center justify-center font-mono text-xs text-background/70 underline-offset-4 transition-colors duration-200 hover:text-background hover:underline ${FOCUS_ON_BAND}`}
          >
            or install it {"->"}
          </a>
        </div>

        <ol aria-label="Open the demo at a layer" className="mt-12 grid grid-cols-2 gap-px border border-background/20 bg-background/20 sm:grid-cols-5">
          {LAYERS.map((layer, i) => (
            <li key={layer.id} className="bg-foreground">
              <Link
                href={layer.demoHref}
                style={{ "--cta-delay": `${i * 45}ms` } as CSSProperties}
                className={`flex min-h-16 flex-col justify-center gap-1 px-4 py-3 font-mono transition-colors duration-200 hover:bg-background hover:text-foreground motion-reduce:transition-none group-has-[[data-cta-primary]:hover]/cta:bg-background group-has-[[data-cta-primary]:hover]/cta:text-foreground group-has-[[data-cta-primary]:hover]/cta:[transition-delay:var(--cta-delay)] ${FOCUS_ON_BAND}`}
              >
                <span className="text-[10px] opacity-50">{layer.ghost}</span>
                <span className="text-xs font-bold uppercase tracking-wider">{layer.navLabel}</span>
                <span className="sr-only">: open {layer.title} in the demo</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
