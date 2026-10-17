"use client"

import * as Popover from "@radix-ui/react-popover"
import { useEffect, useRef } from "react"
import { SITE_VERSION } from "@/lib/site"
import { cn } from "@/lib/utils"
import { InstallTerminal } from "./install-terminal"
import { isNavOverlayOpen, setNavOverlayOpen, takeNavFocusHandoff, useNavOverlayOpen } from "./nav-overlay-store"
import { FOCUS, INSTALL_TRIGGER_CLASS } from "./nav-styles"

const onOpenChange = (next: boolean) => setNavOverlayOpen("install", next)

/**
 * The desktop INSTALL button (inverted) and its popover holding the same
 * install terminal as the hero (plan §4.1). Focus moves into the popover on
 * open; Escape or an outside click closes it and focus returns to the button.
 * Zero radius, like everything else.
 *
 * Loaded after hydration by nav-overlays.tsx (never import it statically):
 * the open state lives in nav-overlay-store, so a click on the placeholder
 * that stood in for this button opens the popover as soon as it mounts.
 */
export function NavInstallPopover({ className }: { className?: string }) {
  const open = useNavOverlayOpen("install")
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Take over keyboard focus from the placeholder this button replaced, unless
  // the popover opened straight away (then its content has the focus).
  useEffect(() => {
    if (takeNavFocusHandoff("install") && !isNavOverlayOpen("install")) triggerRef.current?.focus()
  }, [])

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger ref={triggerRef} className={cn(INSTALL_TRIGGER_CLASS, className)}>
        INSTALL
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Install"
          align="end"
          sideOffset={12}
          collisionPadding={16}
          className="z-[60] max-h-[var(--radix-popover-content-available-height)] w-[min(36rem,calc(100vw_-_2rem))] overflow-y-auto rounded-none border border-foreground bg-background outline-none"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <span className="border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {SITE_VERSION}
            </span>
            <Popover.Close
              className={cn(
                "inline-flex h-7 items-center border border-border px-2 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors duration-200 hover:border-foreground hover:text-foreground",
                FOCUS,
              )}
            >
              CLOSE
              <span className="sr-only"> install</span>
            </Popover.Close>
          </div>
          <InstallTerminal label="Install from the menu bar" framed={false} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
