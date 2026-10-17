// Class strings shared by the nav's overlay triggers: the server-rendered
// placeholder buttons (nav-overlays.tsx) and the real Radix triggers that
// replace them once their code has loaded (nav-install-popover.tsx,
// nav-menu-sheet.tsx). Both must render identically, so nothing moves or
// changes colour when one is swapped for the other.

/** The site focus ring (P0 contract). */
export const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"

/** Extra ring offset for an inverted (white) control. */
export const FOCUS_ON_WHITE = "focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** The inverted desktop INSTALL button; `data-[state=open]` is set by the trigger while the popover is open. */
export const INSTALL_TRIGGER_CLASS = [
  "inline-flex h-8 items-center border border-foreground bg-foreground px-3 font-mono text-xs text-background transition-colors duration-200 hover:bg-transparent hover:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground",
  FOCUS,
  FOCUS_ON_WHITE,
].join(" ")

/** The mobile MENU button. */
export const MENU_TRIGGER_CLASS = [
  "inline-flex min-h-11 items-center border border-border px-2.5 font-mono text-[10px] tracking-widest text-foreground transition-colors duration-200 hover:border-foreground",
  FOCUS,
].join(" ")
