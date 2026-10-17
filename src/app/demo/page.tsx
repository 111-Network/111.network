import type { Metadata } from "next"
import { DemoApp } from "@/components/demo/demo-app"
import { FRAME_STRIP } from "@/components/demo/copy/core"
import { SHELL_COPY } from "@/components/demo/shell/copy"
import { DEMO_COOKIE_SLOT_ID, DEMO_MAIN_ID } from "@/components/demo/shell/frame-ids"
import { SkipToMain } from "@/components/demo/shell/skip-to-main"
import { DEMO_PATH, SITE_NAME, SITE_TAGLINE } from "@/lib/site"
import { DemoSiteBar } from "./site-bar"

const TITLE = SHELL_COPY.pageTitle
const DESCRIPTION = SHELL_COPY.pageDescription
/** Same text as src/app/opengraph-image.alt.txt and twitter-image.alt.txt; keep them in sync. */
const SHARE_IMAGE_ALT = `${SITE_NAME} — ${SITE_TAGLINE}. A message network that runs on people, not servers.`

// Metadata merges shallowly: alternates, openGraph and twitter set here replace the root layout's
// objects whole (the root's canonical "/" and og:url "/" must not leak onto /demo), so each is
// complete, with the root's share images restated.
export const metadata: Metadata = {
  // The root layout's title template appends " · 111 Network".
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: DEMO_PATH },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: DEMO_PATH,
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, type: "image/png", alt: SHARE_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
    images: [{ url: "/twitter-image.png", width: 1200, height: 600, type: "image/png", alt: SHARE_IMAGE_ALT }],
  },
}

/**
 * /demo (plan §6.2): the site bar and the one DEMO strip, server-rendered, then the dashboard as
 * one client island. The page is exactly the viewport tall and never scrolls; the dashboard's main
 * area is the scroll container. Nothing here is fixed: the cookie banner renders into the in-flow
 * slot below the strip (see cookie-banner.tsx), so it pushes the dashboard down instead of covering it.
 */
export default function DemoPage() {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      <SkipToMain targetId={DEMO_MAIN_ID}>{SHELL_COPY.skip}</SkipToMain>
      <DemoSiteBar />
      <p className="shrink-0 border-b border-border px-4 py-1 font-mono text-[10px] leading-4 tracking-widest text-muted-foreground lg:px-8">
        {FRAME_STRIP}
      </p>
      <div id={DEMO_COOKIE_SLOT_ID} className="shrink-0 empty:hidden" />
      <noscript>
        <p className="shrink-0 border-b border-border px-4 py-2 font-mono text-xs text-foreground lg:px-8">{SHELL_COPY.noscript}</p>
      </noscript>
      <DemoApp />
    </div>
  )
}
