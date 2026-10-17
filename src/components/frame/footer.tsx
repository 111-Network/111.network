import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowUp, Download, FileText, Github, Layers, LayoutDashboard, SquareTerminal } from "lucide-react"
import { ASCII_LOGO, GITHUB_URL, SITE_NAME, SITE_TAGLINE } from "@/lib/site"
import { BackToTopButton } from "./footer-actions"
import { exploreLinks, type ExploreLabel } from "./footer-links"
import { AnchorLink } from "./nav-anchor-link"

// Frame footer (plan §4.5, §2.1 V12). A Server Component: only the in-page
// links (the nav's AnchorLink) and back-to-top (footer-actions.tsx) are client
// leaves. The Explore list and its rules live in footer-links.ts. The Built
// With tech chips are gone (W1); the "Open Source" badge stays word for word (W6).

/** Evaluated once when the module loads (build time for this static page), never during render. */
const COPYRIGHT_YEAR = new Date().getFullYear()

/** `-mx-2 px-2`: the focus ring clears the icon and the "->" by 8 px while the text stays aligned with the column. */
const LINK_CLASS =
  "group -mx-2 flex min-h-11 items-center gap-3 px-2 py-2 font-mono text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none lg:min-h-0"

const LABEL_CLASS = "mb-4 block font-mono text-xs uppercase tracking-widest text-muted-foreground"

/** Icon + label + the "->" that appears on hover / keyboard focus. */
function LinkBody({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <>
      {icon}
      <span>{children}</span>
      <span
        aria-hidden="true"
        className="ml-auto opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {"->"}
      </span>
    </>
  )
}

/** The icon drawn before each Explore label. */
const EXPLORE_ICONS: Record<ExploreLabel, ReactNode> = {
  Layers: <Layers size={14} aria-hidden="true" />,
  Demo: <LayoutDashboard size={14} aria-hidden="true" />,
  Terminal: <SquareTerminal size={14} aria-hidden="true" />,
  Install: <Download size={14} aria-hidden="true" />,
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-3">
          {/* ASCII logo */}
          <div>
            {/*
              Seamless blocks: the rows overlap a little (leading 9 px at 8 px, 12 px at
              10 px), and the dimming is element opacity, not a translucent text colour,
              which would paint every overlap twice and draw a bright seam. Measured
              at 1x, 2x and 3x.
            */}
            <pre
              className="font-mono text-[8px] leading-[9px] text-foreground opacity-40 md:text-[10px] md:leading-[12px]"
              aria-label={`${SITE_NAME} ASCII logo`}
              role="img"
            >
              {ASCII_LOGO}
            </pre>
            <p className="mt-4 max-w-xs font-mono text-xs leading-relaxed text-muted-foreground">{SITE_TAGLINE}</p>
          </div>

          {/* Connect */}
          <nav aria-labelledby="footer-connect">
            <span id="footer-connect" className={LABEL_CLASS}>
              Connect
            </span>
            <ul className="flex flex-col gap-2">
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                  <LinkBody icon={<Github size={14} aria-hidden="true" />}>
                    GitHub<span className="sr-only"> (opens in a new tab)</span>
                  </LinkBody>
                </a>
              </li>
              <li>
                <Link href="/terms" className={LINK_CLASS}>
                  <LinkBody icon={<FileText size={14} aria-hidden="true" />}>Terms of Service</LinkBody>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Explore, the Open Source badge and back to top */}
          <div className="flex flex-col justify-between">
            <div>
              <nav aria-labelledby="footer-explore">
                <span id="footer-explore" className={LABEL_CLASS}>
                  Explore
                </span>
                <ul className="flex flex-col gap-2">
                  {exploreLinks().map((link) => (
                    <li key={link.label}>
                      {"anchor" in link ? (
                        <AnchorLink to={link.anchor} className={LINK_CLASS}>
                          <LinkBody icon={EXPLORE_ICONS[link.label]}>{link.label}</LinkBody>
                        </AnchorLink>
                      ) : (
                        <Link href={link.href} className={LINK_CLASS}>
                          <LinkBody icon={EXPLORE_ICONS[link.label]}>{link.label}</LinkBody>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  Open Source
                </span>
              </div>
            </div>

            <BackToTopButton className="-mx-2 mt-8 flex min-h-11 items-center gap-2 self-start px-2 font-mono text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none lg:min-h-0 lg:self-end">
              <ArrowUp size={12} aria-hidden="true" />
              <span>BACK TO TOP</span>
            </BackToTopButton>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <span className="font-mono text-[10px] text-muted-foreground">{`// ${SITE_NAME} — ${COPYRIGHT_YEAR}`}</span>
          <span className="font-mono text-[10px] text-muted-foreground">Built by people, not providers.</span>
        </div>
      </div>
    </footer>
  )
}
