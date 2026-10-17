// The /demo site bar (plan §6.2): logo -> home, INSTALL, the GitHub org. A Server Component outside
// the dashboard shell, so it may use viewport breakpoints. INSTALL reuses the home nav's install
// popover (the same install terminal as the hero, loaded after hydration at lg and up; its import
// graph has no motion or icon package); below lg it is a link to the hero's install box.
import Link from "next/link"
import { NavInstall } from "@/components/frame/nav-overlays"
import { SHELL_COPY } from "@/components/demo/shell/copy"
import { ANCHORS, GITHUB_URL } from "@/lib/site"
import { cn } from "@/lib/utils"

const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
const FOCUS_ON_WHITE = "focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** The GitHub mark, monochrome (currentColor). */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

export function DemoSiteBar() {
  const copy = SHELL_COPY.site
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:px-8">
      <Link
        href="/"
        aria-label={copy.logoLabel}
        className={cn("flex min-h-11 shrink-0 items-center gap-2 font-mono text-sm text-foreground transition-opacity duration-200 hover:opacity-70", FOCUS)}
      >
        <span aria-hidden="true" className="text-muted-foreground">
          {">"}
        </span>
        <span className="font-pixel tracking-wider">{copy.logo}</span>
      </Link>

      <nav aria-label="Site" className="ml-auto flex items-center gap-2">
        {/* lg and up: the popover (its trigger keeps the home nav's exact look). */}
        <span className="hidden lg:contents">
          <NavInstall />
        </span>
        {/* Below lg: the hero's install box on the home page. */}
        <Link
          href={`/#${ANCHORS.install}`}
          className={cn(
            "inline-flex min-h-11 items-center border border-foreground bg-foreground px-2.5 font-mono text-[10px] tracking-widest text-background transition-colors duration-200 hover:bg-transparent hover:text-foreground lg:hidden",
            FOCUS,
            FOCUS_ON_WHITE,
          )}
        >
          {copy.install}
        </Link>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.github}
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors duration-200 hover:bg-foreground hover:text-background lg:h-8 lg:w-8",
            FOCUS,
          )}
        >
          <GitHubMark className="h-4 w-4" />
        </a>
      </nav>
    </header>
  )
}
