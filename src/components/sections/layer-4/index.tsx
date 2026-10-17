import Link from "next/link"
import { LayerSection } from "@/components/common/layer-section"
import { getLayer } from "@/lib/layers"
import { NodeWindow } from "./node-window"

/** Layer 4 · Interface & Dashboard: the Node Window teaser + the bold demo CTA (plan §5 L4, W12). */
export function Layer4() {
  const { specs, demoHref } = getLayer(4)
  return (
    <LayerSection n={4} footer={false}>
      <div className="mt-12">
        <NodeWindow />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <dl className="grid border border-border sm:grid-cols-2 xl:grid-cols-4">
          {specs.map((spec) => (
            <div key={spec.label} className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{spec.label}</dt>
              <dd className="font-mono text-sm font-bold text-foreground">{spec.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col items-stretch gap-2 sm:items-start lg:items-end">
          <Link
            href={demoHref}
            className="group inline-flex min-h-14 items-center justify-center gap-3 border border-foreground bg-foreground px-5 py-4 text-center font-mono text-sm font-bold uppercase tracking-wider text-background sm:px-8 sm:text-base transition-colors duration-200 hover:bg-transparent hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            Open the full dashboard demo
            <span aria-hidden="true" className="shrink-0 whitespace-nowrap transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">
              {"->"}
            </span>
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Interactive · sample data · nothing leaves the page
          </p>
        </div>
      </div>
    </LayerSection>
  )
}
