// The sidebar (real app/Sidebar.tsx, ported under plan §6.5). One component, three layouts, chosen
// from the SHELL ROOT's width (never the viewport):
//   docked  ≥ 1024 px: 260 px, collapsible to the 56 px icon rail (saved after mount by the store);
//   rail    the icon rail (also forced by layout "rail", the L4 teaser);
//   drawer  < 1024 px: an off-canvas dialog, `absolute` inside the shell root (nothing is fixed),
//           focus-trapped, closed by Escape (anywhere on the page while it is open) / CLOSE / the
//           overlay / any navigation.
// In the rail, where the state word does not fit, every dot gets a one-character state mark and a
// tooltip with the state word, so a state never shows by colour alone.
// Before the first measurement ("unknown") it renders docked and a container query hides it below
// 1024 px, so the server render is already right at both sizes.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { DemoLink, useDemo, useDispatch, useRoute, useWorld } from "../engine/react"
import { isActive, PATHS } from "../engine/router"
import { nodeHealth, selectServices } from "../engine/selectors"
import type { UiMode } from "../engine/types"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Segmented } from "../ui/segmented"
import { DOT_LABEL, DOT_MARK, statusDotText, type DotState } from "../ui/status"
import { StatusDot } from "../ui/status-dot"
import { useShellEmbedded } from "./context"
import { SHELL_COPY } from "./copy"
import { canCollapse, isRail, type ResolvedLayout } from "./layout"
import { glyphOf, inSettings as routeInSettings, visibleNav, type NavItem, type ServiceNavItem } from "./nav"
import { selectAgentSeen, selectAlias, selectLayoutPref, selectMode, selectRailCollapsed } from "./select"
import { useMoreBelow } from "./use-more-below"

export type CloseFocus = "menu" | "main"

export interface SidebarIds {
  sidebar: string
  close: string
  settings: string
  unavailable: string
}

export interface SidebarProps {
  ids: SidebarIds
  layout: ResolvedLayout
  /** The drawer layout with the drawer open. */
  drawerActive: boolean
  /** Close the drawer; `focus` says where focus goes once it is gone. */
  onClose: (focus: CloseFocus) => void
  /** A row was clicked (the drawer then hands focus to the main area). */
  onNavigate: () => void
}

const FOCUSABLE = 'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

const ROW =
  "group flex min-h-11 w-full items-center gap-3 px-3 text-start font-mono text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"

/**
 * Row colours. `signal` = the one signal-orange row (DESIGN.md "Signal orange"): the Agent row until
 * the visitor first opens the Agent; once opened it is a normal row for good.
 */
function rowTone(active: boolean, signal = false): string {
  if (active) return "bg-foreground text-background focus-visible:ring-background"
  if (signal) return "bg-signal text-background hover:bg-foreground focus-visible:ring-background"
  return "text-muted-foreground hover:bg-foreground hover:text-background focus-visible:ring-foreground"
}

interface NavRowProps {
  href: string
  active: boolean
  rail: boolean
  label: string
  glyph: string
  /** Leading dot (service rows). Its screen-reader text then names the row and the visible name is hidden from AT. */
  dot?: ReactNode
  trail?: ReactNode
  caps?: boolean
  /** The rail tooltip (default: the label). Service rows add their state word. */
  railTitle?: string
  /** Wear the signal orange (only the Agent row, until it is first opened). */
  signal?: boolean
  onNavigate: () => void
}

/** The rail's one-character state mark beside a dot (hidden from AT: the dot's sr text has the word). */
function RailMark({ state, active }: { state: DotState; active: boolean }) {
  return (
    <span aria-hidden="true" className={cn("text-[10px] leading-none", active ? "text-background" : "text-muted-foreground group-hover:text-background")}>
      {DOT_MARK[state]}
    </span>
  )
}

function NavRow({ href, active, rail, label, glyph, dot, trail, caps = false, railTitle, signal = false, onNavigate }: NavRowProps) {
  return (
    <DemoLink
      to={href}
      aria-current={active ? "page" : undefined}
      title={rail ? (railTitle ?? label) : undefined}
      onClick={onNavigate}
      className={cn(ROW, rowTone(active, signal), caps && "uppercase tracking-widest", rail && "justify-center px-0")}
    >
      {rail ? (
        dot ? (
          <span className="inline-flex items-center gap-1.5">
            {dot}
            {trail}
          </span>
        ) : (
          <>
            <span aria-hidden="true">{glyph}</span>
            <span className="sr-only">{label}</span>
          </>
        )
      ) : (
        <>
          {dot}
          <span aria-hidden={dot ? true : undefined} className="min-w-0 flex-1 truncate">
            {label}
          </span>
          {trail}
        </>
      )}
    </DemoLink>
  )
}

function ServiceRow({ item, active, rail, onNavigate }: { item: ServiceNavItem; active: boolean; rail: boolean; onNavigate: () => void }) {
  return (
    <NavRow
      href={item.href}
      active={active}
      rail={rail}
      label={item.label}
      glyph={glyphOf(item.label)}
      railTitle={statusDotText(item.state, item.label)}
      onNavigate={onNavigate}
      dot={<StatusDot state={item.state} label={false} name={item.label} />}
      trail={
        rail ? (
          <RailMark state={item.state} active={active} />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0 text-[10px] uppercase tracking-widest",
              active ? "text-background" : "text-muted-foreground group-hover:text-background",
            )}
          >
            {DOT_LABEL[item.state]}
          </span>
        )
      }
    />
  )
}

function SectionLabel({ rail, children }: { rail: boolean; children: ReactNode }) {
  if (rail) return <div aria-hidden="true" className="mx-3 mt-3 mb-1 border-t border-border" />
  return (
    <p aria-hidden="true" className="px-3 pt-5 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  )
}

function GroupToggle({ id, open, onToggle, children, caps = false }: { id: string; open: boolean; onToggle: () => void; children: ReactNode; caps?: boolean }) {
  return (
    <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className={cn(ROW, rowTone(false), caps && "uppercase tracking-widest")}>
      <span aria-hidden="true" className="inline-block w-3 shrink-0 text-center">
        {open ? "v" : ">"}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

/** The node chip (real NodeChip): this node's name, its device in plain words (never a category code), its health. */
function NodeChip({ rail }: { rail: boolean }) {
  const world = useWorld()
  const name = useDemo(selectAlias)
  const health = useDemo(nodeHealth)
  if (rail) {
    return (
      <div className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 border-b border-border" title={SHELL_COPY.node.railTitle(name, DOT_LABEL[health])}>
        <StatusDot state={health} label={false} name={SHELL_COPY.node.health(name)} />
        <RailMark state={health} active={false} />
      </div>
    )
  }
  return (
    <div className="shrink-0 border-b border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-mono text-sm text-foreground" title={name}>
          {name}
        </p>
        <Badge className="shrink-0">{world.self.badge}</Badge>
      </div>
      <div className="mt-2">
        <StatusDot state={health} name={SHELL_COPY.node.health(name)} />
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{SHELL_COPY.node.caption}</p>
    </div>
  )
}

const MODE_OPTIONS = [
  { value: "simple", label: SHELL_COPY.mode.simple },
  { value: "advanced", label: SHELL_COPY.mode.advanced },
] as const

export function Sidebar({ ids, layout, drawerActive, onClose, onNavigate }: SidebarProps) {
  const dispatch = useDispatch()
  const route = useRoute()
  const mode = useDemo(selectMode)
  const agentSeen = useDemo(selectAgentSeen)
  const layoutPref = useDemo(selectLayoutPref)
  const railCollapsed = useDemo(selectRailCollapsed)
  const services = useDemo(selectServices)
  const path = route?.path ?? ""
  const drawer = layout === "drawer"
  const railed = !drawer && isRail(layout, { railCollapsed })
  const nav = visibleNav(mode, services)
  const advanced = mode === "advanced"
  const panelRef = useRef<HTMLDivElement>(null)
  const [scrollRef, moreBelow] = useMoreBelow<HTMLDivElement>()
  const embedded = useShellEmbedded()

  // The groups open by themselves when the route enters them (state adjusted during render, the
  // React pattern for "reset on prop change"; no effect, no flash).
  const inSettings = routeInSettings(route)
  const [settingsOpen, setSettingsOpen] = useState(inSettings)
  const [wasInSettings, setWasInSettings] = useState(inSettings)
  if (inSettings !== wasInSettings) {
    setWasInSettings(inSettings)
    if (inSettings) setSettingsOpen(true)
  }
  const inUnavailable = nav.unavailable.some((s) => isActive(s.href, path))
  const [unavailableOpen, setUnavailableOpen] = useState(inUnavailable)
  const [wasInUnavailable, setWasInUnavailable] = useState(inUnavailable)
  if (inUnavailable !== wasInUnavailable) {
    setWasInUnavailable(inUnavailable)
    if (inUnavailable) setUnavailableOpen(true)
  }

  // Escape closes the open drawer wherever focus is (real Sidebar: a document listener), also when
  // focus sits on the page body or on the /demo site bar. It listens on the WINDOW: Next's React
  // root is the document itself, so a listener there would run beside React's and a confirm's
  // stopPropagation would not reach it; on the window it runs after React has handled the key. An
  // open confirm's Escape stops first; a key something else already handled is left alone.
  useEffect(() => {
    const win = panelRef.current?.ownerDocument.defaultView
    if (!drawerActive || !win) return
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      e.preventDefault()
      onClose("menu")
    }
    win.addEventListener("keydown", onEscape)
    return () => win.removeEventListener("keydown", onEscape)
  }, [drawerActive, onClose])

  // Tab and Shift+Tab wrap inside the drawer.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!drawerActive) return
    if (e.key !== "Tab" || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    const current = e.currentTarget.ownerDocument.activeElement
    if (e.shiftKey && (current === first || !panelRef.current.contains(current))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (current === last || !panelRef.current.contains(current))) {
      e.preventDefault()
      first.focus()
    }
  }

  const setMode = (next: UiMode) => dispatch({ type: "core/setMode", mode: next })

  const row = (item: NavItem, caps = false) => (
    <li key={item.id}>
      <NavRow
        href={item.href}
        active={isActive(item.href, path)}
        rail={railed}
        label={item.label}
        glyph={glyphOf(item.label)}
        caps={caps}
        signal={item.id === "agent" && !agentSeen}
        onNavigate={onNavigate}
      />
    </li>
  )

  const serviceRow = (s: ServiceNavItem) => (
    <li key={s.id}>
      <ServiceRow item={s} active={isActive(s.href, path)} rail={railed} onNavigate={onNavigate} />
    </li>
  )

  return (
    <>
      {drawerActive ? <div aria-hidden="true" className="absolute inset-0 z-40 bg-background/80" onClick={() => onClose("menu")} /> : null}
      <div
        ref={panelRef}
        id={ids.sidebar}
        role={drawer ? "dialog" : undefined}
        aria-modal={drawerActive ? true : undefined}
        aria-label={drawer ? SHELL_COPY.drawer.label : undefined}
        hidden={drawer && !drawerActive}
        onKeyDown={onKeyDown}
        data-layout={layout}
        className={cn(
          "flex flex-col border-border bg-background",
          drawer
            ? "absolute inset-y-0 start-0 z-50 w-72 max-w-[85%] border-e"
            : cn("relative shrink-0 border-e", railed ? "w-14" : "w-65", layout === "unknown" && "@max-[1024px]:hidden"),
        )}
      >
        {drawer ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{SHELL_COPY.drawer.caption}</span>
            <Button id={ids.close} size="sm" onClick={() => onClose("menu")}>
              {SHELL_COPY.drawer.close}
            </Button>
          </div>
        ) : null}

        <NodeChip rail={railed} />

        <nav aria-label={embedded ? SHELL_COPY.nav.landmarkEmbedded : SHELL_COPY.nav.landmark} className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} className="h-full overflow-x-hidden overflow-y-auto py-2">
              <ul aria-label={SHELL_COPY.nav.pages} className="flex flex-col">
                {nav.core.map((i) => row(i, true))}
              </ul>

              <SectionLabel rail={railed}>{SHELL_COPY.nav.services}</SectionLabel>
              <ul aria-label={SHELL_COPY.nav.servicesList} className="flex flex-col">
                {nav.services.map(serviceRow)}
              </ul>
              {nav.unavailable.length > 0 && !railed ? (
                <div>
                  <GroupToggle id={ids.unavailable} open={unavailableOpen} onToggle={() => setUnavailableOpen((o) => !o)}>
                    {SHELL_COPY.nav.unavailable(nav.unavailable.length)}
                  </GroupToggle>
                  <ul id={ids.unavailable} aria-label={SHELL_COPY.nav.unavailableList} hidden={!unavailableOpen} className="flex flex-col ps-3">
                    {nav.unavailable.map(serviceRow)}
                  </ul>
                </div>
              ) : null}
              {/* The rail has no room for a group toggle, but the pages must stay reachable: dimmed rows. */}
              {nav.unavailable.length > 0 && railed ? (
                <ul aria-label={SHELL_COPY.nav.unavailableList} className="flex flex-col opacity-60">
                  {nav.unavailable.map(serviceRow)}
                </ul>
              ) : null}
            </div>
            {moreBelow ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 flex h-6 items-center justify-center border-t border-border bg-background/95 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                {railed ? SHELL_COPY.nav.moreRail : SHELL_COPY.nav.more}
              </div>
            ) : null}
          </div>

          {/* Settings stays pinned above the mode switch; its own list scrolls when the ten layer pages are open. */}
          <div className="shrink-0 border-t border-border">
            {railed ? (
              <NavRow
                href={PATHS.settings}
                active={inSettings}
                rail
                label={SHELL_COPY.nav.settings}
                glyph={glyphOf(SHELL_COPY.nav.settings)}
                onNavigate={onNavigate}
              />
            ) : (
              <>
                <GroupToggle id={ids.settings} caps open={settingsOpen} onToggle={() => setSettingsOpen((o) => !o)}>
                  {SHELL_COPY.nav.settings}
                </GroupToggle>
                <ul id={ids.settings} aria-label={SHELL_COPY.nav.settings} hidden={!settingsOpen} className="flex max-h-48 flex-col overflow-y-auto ps-3">
                  {nav.settings.map((i) => row(i))}
                </ul>
              </>
            )}
          </div>
        </nav>

        <div className={cn("flex shrink-0 flex-col gap-2 border-t border-border", railed ? "items-center p-1" : "p-3")}>
          {railed ? (
            <button
              type="button"
              aria-pressed={advanced}
              aria-label={SHELL_COPY.mode.railLabel}
              title={advanced ? SHELL_COPY.mode.railOn : SHELL_COPY.mode.railOff}
              onClick={() => setMode(advanced ? "simple" : "advanced")}
              className={cn(
                "min-h-11 w-full border font-mono text-[10px] tracking-widest focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                advanced ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden="true">{advanced ? SHELL_COPY.mode.badge : SHELL_COPY.mode.railSimple}</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <Segmented<UiMode> label={SHELL_COPY.mode.group} value={mode} onChange={setMode} options={MODE_OPTIONS} />
              {advanced ? <Badge aria-hidden="true">{SHELL_COPY.mode.badge}</Badge> : null}
            </div>
          )}
          {canCollapse({ layout: layoutPref }, layout) ? (
            <button
              type="button"
              aria-expanded={!railed}
              aria-controls={ids.sidebar}
              aria-label={railed ? SHELL_COPY.rail.expand : SHELL_COPY.rail.collapse}
              title={railed ? SHELL_COPY.rail.expand : SHELL_COPY.rail.collapse}
              onClick={() => dispatch({ type: "core/toggleRail" })}
              className="flex min-h-11 w-full items-center gap-2 px-3 font-mono text-xs text-muted-foreground hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-inset focus-visible:outline-none"
            >
              <span aria-hidden="true">{railed ? ">>" : "<<"}</span>
              {railed ? null : <span aria-hidden="true">{SHELL_COPY.rail.collapseWord}</span>}
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}
