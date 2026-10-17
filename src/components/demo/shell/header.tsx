// The shell header (real app/Header.tsx): MENU (drawer layout only), the view title, and the
// attention badge (open proposals + errors + message requests) linking to what needs you. It is a
// plain flex row: the main area below it is the scroll container, so nothing needs to stick. It is a
// <div>, not a <header>: on /demo the site bar is the page's banner (a second one fails
// landmark-no-duplicate-banner), and in the L4 window the home page has its own.
import { cn } from "@/lib/utils"
import { DemoLink, useDemo } from "../engine/react"
import { attentionCount, attentionHref, attentionSummary, routeTitle } from "../engine/selectors"
import { AttentionBadge } from "../ui/attention-badge"
import { Button } from "../ui/button"
import { FOCUS_RING } from "../ui/classes"
import { SHELL_COPY } from "./copy"
import { showsMenu, type ResolvedLayout } from "./layout"

export interface HeaderProps {
  layout: ResolvedLayout
  menuId: string
  sidebarId: string
  drawerActive: boolean
  onMenu: () => void
}

export function Header({ layout, menuId, sidebarId, drawerActive, onMenu }: HeaderProps) {
  const title = useDemo(routeTitle)
  const count = useDemo(attentionCount)
  const href = useDemo(attentionHref)
  const summary = useDemo(attentionSummary)
  return (
    <div className="shrink-0 border-b border-border bg-background">
      <div className="flex h-14 items-center gap-3 px-4 @min-[1024px]:px-8">
        {showsMenu(layout) ? (
          <Button
            id={menuId}
            size="sm"
            aria-haspopup="dialog"
            aria-expanded={drawerActive}
            aria-controls={sidebarId}
            onClick={onMenu}
            // Before the first measurement a container query decides; afterwards only the drawer layout shows it.
            className={cn(layout === "unknown" && "@min-[1024px]:hidden")}
          >
            {SHELL_COPY.drawer.open}
          </Button>
        ) : null}
        <p className="min-w-0 flex-1 truncate font-pixel-line text-lg text-foreground">{title}</p>
        {count > 0 ? (
          <DemoLink to={href} title={summary} className={cn("inline-flex min-h-11 min-w-11 items-center justify-center", FOCUS_RING)}>
            <AttentionBadge count={count} />
          </DemoLink>
        ) : null}
      </div>
    </div>
  )
}
