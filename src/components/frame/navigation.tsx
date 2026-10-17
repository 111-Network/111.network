import Link from "next/link"
import { ANCHORS, DEMO_PATH, DEMO_READY, GITHUB_URL } from "@/lib/site"
import { cn } from "@/lib/utils"
import { AnchorLink, TopLink } from "./nav-anchor-link"
import { NavDepthStrip } from "./nav-depth-strip"
import { NavInstall, NavMenu } from "./nav-overlays"
import { NavLongReadout, NavRail, NavShortReadout } from "./nav-rail"
import { FOCUS, FOCUS_ON_WHITE } from "./nav-styles"

const TEXT_LINK =
  "inline-flex h-8 items-center px-3 font-mono text-xs text-muted-foreground transition-colors duration-200 hover:bg-foreground hover:text-background"

/** The GitHub mark, monochrome (currentColor). */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/**
 * The site header (plan §4.1). Server-rendered shell with small client islands:
 * the layer rail and readouts (one shared scroll-spy), the INSTALL popover,
 * the mobile MENU sheet and the depth strip. Sticky, with the backdrop blur
 * DESIGN.md allows on the nav only. The popover and the sheet are loaded after
 * hydration, off the first-load JS (nav-overlays.tsx).
 *
 * - Desktop (lg+): logo · rail 0…9 · xl readout · DEMO (once ready) · TERMINAL · INSTALL · GitHub.
 * - Mobile: logo · "L3/9" · INSTALL (to #install) · MENU.
 */
export function Navigation() {
  return (
    <header className="sticky top-0 z-50 h-nav bg-background/80 backdrop-blur-md">
      {/*
        The padding is set under focus: on purpose: `not-sr-only` resets padding to 0,
        and only the focus: variants are emitted after it (Tailwind 4 sorts them later).
      */}
      <a
        href={`#${ANCHORS.main}`}
        className="sr-only bg-foreground font-mono text-xs text-background focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[70] focus:px-3 focus:py-2 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 lg:gap-4 lg:px-8">
        <TopLink
          aria-label="111.network, back to top"
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-2 font-mono text-sm text-foreground transition-opacity duration-200 hover:opacity-70",
            FOCUS,
          )}
        >
          <span aria-hidden="true" className="text-muted-foreground">
            {">"}
          </span>
          <span className="font-pixel tracking-wider">111.network</span>
        </TopLink>

        {/* Desktop */}
        <nav aria-label="Site" className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
          <NavRail />
          {/* w-56 (224 px) fits the longest readout, "L9 · SELF-HEALING & EVOLUTION" (nav-model.test.ts). */}
          <NavLongReadout className="hidden w-56 xl:block" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {DEMO_READY ? (
              <Link href={DEMO_PATH} className={cn(TEXT_LINK, FOCUS)}>
                DEMO
              </Link>
            ) : null}
            <AnchorLink to={ANCHORS.terminal} className={cn(TEXT_LINK, FOCUS)}>
              TERMINAL
            </AnchorLink>
            <NavInstall />
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="111 Network on GitHub"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors duration-200 hover:bg-foreground hover:text-background",
                FOCUS,
              )}
            >
              <GitHubMark className="h-4 w-4" />
            </a>
          </div>
        </nav>

        {/* Mobile */}
        <nav aria-label="Site" className="ml-auto flex items-center gap-2 lg:hidden">
          <NavShortReadout className="hidden min-[360px]:inline" />
          <AnchorLink
            to={ANCHORS.install}
            className={cn(
              "inline-flex min-h-11 items-center border border-foreground bg-foreground px-2.5 font-mono text-[10px] tracking-widest text-background transition-colors duration-200 hover:bg-transparent hover:text-foreground",
              FOCUS,
              FOCUS_ON_WHITE,
            )}
          >
            INSTALL
          </AnchorLink>
          <NavMenu />
        </nav>
      </div>

      <NavDepthStrip />
    </header>
  )
}
