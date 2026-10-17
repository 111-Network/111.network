"use client"

import * as Dialog from "@radix-ui/react-dialog"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { LAYERS } from "@/lib/layers"
import { scrollToAnchor } from "@/lib/scroll"
import { ANCHORS, DEMO_PATH, DEMO_READY, GITHUB_URL } from "@/lib/site"
import { cn } from "@/lib/utils"
import { AnchorLink } from "./nav-anchor-link"
import { isNavOverlayOpen, setNavOverlayOpen, takeNavFocusHandoff, useNavOverlayOpen } from "./nav-overlay-store"
import { useActiveLayer } from "./nav-spy"
import { FOCUS, FOCUS_ON_WHITE, MENU_TRIGGER_CLASS } from "./nav-styles"

const LINK =
  "flex min-h-11 items-center justify-between border border-border px-3 font-mono text-xs tracking-widest text-muted-foreground transition-colors duration-200 hover:border-foreground hover:text-foreground"

const onOpenChange = (next: boolean) => setNavOverlayOpen("menu", next)
const close = () => setNavOverlayOpen("menu", false)

/**
 * Mobile MENU (plan §4.1): a full-height, focus-trapped sheet with a 2×5 grid
 * of layer tiles, then DEMO (once ready) and TERMINAL. Choosing a tile closes
 * the sheet first; the scroll happens when the sheet is gone (in
 * onCloseAutoFocus, after the scroll lock is released), and focus lands on
 * the chosen section instead of returning to MENU.
 *
 * Loaded after hydration by nav-overlays.tsx (never import it statically):
 * the open state lives in nav-overlay-store, so a tap on the placeholder
 * that stood in for MENU opens the sheet as soon as it mounts, and crossing
 * the lg breakpoint closes it.
 */
export function NavMenuSheet({ className }: { className?: string }) {
  const open = useNavOverlayOpen("menu")
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingRef = useRef<string | null>(null)
  const active = useActiveLayer()

  // Take over keyboard focus from the placeholder this button replaced, unless
  // the sheet opened straight away (then the sheet has the focus).
  useEffect(() => {
    if (takeNavFocusHandoff("menu") && !isNavOverlayOpen("menu")) triggerRef.current?.focus()
  }, [])

  const go = (to: string) => {
    pendingRef.current = to
    close()
  }

  const onCloseAutoFocus = (event: Event) => {
    const to = pendingRef.current
    if (!to) return
    pendingRef.current = null
    if (scrollToAnchor(to)) event.preventDefault()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger ref={triggerRef} className={cn(MENU_TRIGGER_CLASS, className)}>
        MENU
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-background/90" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col overflow-y-auto rounded-none border-l border-border bg-background outline-none sm:max-w-md"
        >
          <div className="flex h-nav shrink-0 items-center justify-between border-b border-border px-4">
            <Dialog.Title className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Menu
            </Dialog.Title>
            <Dialog.Close
              className={cn(
                "inline-flex min-h-11 items-center border border-border px-3 font-mono text-[10px] tracking-widest text-foreground transition-colors duration-200 hover:border-foreground",
                FOCUS,
              )}
            >
              CLOSE
              <span className="sr-only"> menu</span>
            </Dialog.Close>
          </div>

          <nav aria-label="Layers and pages" className="flex flex-col gap-6 p-4">
            <div className="flex flex-col gap-3">
              <p aria-hidden="true" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Layers 0–9
              </p>
              <ol className="grid grid-cols-2 gap-2">
                {LAYERS.map((layer) => {
                  const current = active === layer.n
                  return (
                    <li key={layer.id}>
                      {/*
                        No aria-label: the name is the tile's own text, "Layer 3 INTELLIGENCE",
                        so it contains the visible label (WCAG 2.5.3) and speech control
                        matches what is on screen.
                      */}
                      <AnchorLink
                        to={layer.id}
                        onActivate={go}
                        aria-current={current ? "location" : undefined}
                        className={cn(
                          "flex min-h-16 flex-col justify-between gap-2 border p-3 transition-colors duration-200",
                          FOCUS,
                          current
                            ? cn("border-foreground bg-foreground text-background", FOCUS_ON_WHITE)
                            : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                        )}
                      >
                        <span className="font-pixel-line text-2xl font-bold leading-none">
                          <span className="sr-only">Layer </span>
                          {layer.n}
                        </span>{" "}
                        <span className="font-mono text-[10px] tracking-widest">{layer.navLabel}</span>
                      </AnchorLink>
                    </li>
                  )
                })}
              </ol>
            </div>

            <ul className="flex flex-col gap-2">
              {DEMO_READY ? (
                <li>
                  <Link href={DEMO_PATH} onClick={close} className={cn(LINK, FOCUS)}>
                    DEMO
                    <span aria-hidden="true">{"->"}</span>
                  </Link>
                </li>
              ) : null}
              <li>
                <AnchorLink to={ANCHORS.terminal} onActivate={go} className={cn(LINK, FOCUS)}>
                  TERMINAL
                  <span aria-hidden="true">{"->"}</span>
                </AnchorLink>
              </li>
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={cn(LINK, FOCUS)}>
                  GitHub
                  <span aria-hidden="true">{"->"}</span>
                </a>
              </li>
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
