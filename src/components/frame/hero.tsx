import { ANCHORS, GITHUB_URL, SITE_DESCRIPTION, SITE_VERSION } from "@/lib/site"
import { cn } from "@/lib/utils"
import { HeroField } from "./hero-field"
import { InstallTerminal } from "./install-terminal"
import { AnchorLink } from "./nav-anchor-link"

const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"

/**
 * The hero (plan §3): the W9 version badge, the unchanged title, the §3.1
 * subtitle, two CTAs, the install terminal (#install) and a static scroll
 * hint. A Server Component: the copy is in the HTML; only the background
 * field, the CTA's scroll and the install terminal are client islands.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex min-h-[calc(100svh_-_var(--spacing-nav))] flex-col items-center justify-center overflow-hidden px-4 py-16 lg:py-24"
    >
      <HeroField />

      <div className="relative z-20 flex w-full max-w-4xl flex-col items-start gap-8 text-left">
        {/*
          w-full: the column takes the hero's width instead of the widest unbreakable
          word's, so the subtitle wraps to the viewport (WCAG 1.4.10 at 320 px).
        */}
        <div className="flex w-full min-w-0 flex-col items-start gap-6">
          {/* W9: inverts every 2 s (steps, no fade); static and inverted under reduced motion (globals.css). */}
          <p className="animate-invert inline-flex items-center border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
            {SITE_VERSION}
          </p>

          {/* "Communication" is 328 px at text-5xl: one step smaller below 360 px so it never clips. */}
          <h1
            id="hero-title"
            className="font-pixel-line text-5xl font-bold leading-none tracking-tight text-foreground text-balance max-[360px]:text-4xl md:text-7xl lg:text-9xl"
          >
            Free, Secure
            <br />
            <span className="text-muted-foreground">Communication for Everyone</span>
          </h1>

          {/* Solid background: the ASCII field stops behind the copy, so the lines read clean. */}
          <p className="max-w-prose bg-background font-mono text-sm leading-relaxed text-muted-foreground md:text-base">
            {SITE_DESCRIPTION}
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <AnchorLink
            to="layer-0"
            className={cn(
              "group flex min-h-11 items-center gap-2 border border-foreground bg-foreground px-6 py-3 font-mono text-sm text-background transition-all duration-200 hover:bg-transparent hover:text-foreground",
              FOCUS,
              "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            Explore the layers
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
              {"->"}
            </span>
          </AnchorLink>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex min-h-11 items-center gap-2 border border-border bg-background px-6 py-3 font-mono text-sm text-muted-foreground transition-all duration-200 hover:border-foreground hover:text-foreground",
              FOCUS,
            )}
          >
            GitHub
          </a>
        </div>

        <InstallTerminal id={ANCHORS.install} className="mt-4 max-w-2xl scroll-mt-nav" />
      </div>

      {/* Static hint: no bounce, nothing to switch off under reduced motion. */}
      <div aria-hidden="true" className="relative z-20 mt-16 flex flex-col items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          scroll · start at layer 0
        </span>
        <span className="h-4 w-px bg-muted-foreground" />
      </div>
    </section>
  )
}
