"use client"

import Link from "next/link"
import type { ComponentPropsWithoutRef, MouseEvent } from "react"
import { scrollBehavior } from "@/lib/motion"
import { scrollToAnchor } from "@/lib/scroll"
import { isPlainClick } from "./nav-model"

/** Props of AnchorLink: any <a> attributes except href / onClick, plus the target id. */
export interface AnchorLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick"> {
  /** Id of the target element, without "#" (e.g. "layer-0", ANCHORS.install). */
  to: string
  /**
   * Replaces the built-in scroll: called with `to` on a plain click (the
   * default is already prevented). The mobile sheet uses it to close first
   * and scroll once the sheet is gone.
   */
  onActivate?: (to: string) => void
}

/**
 * A real in-page link (`<a href="#id">`, so it works without script and opens
 * in a new tab on a modified click). A plain click goes through scrollToAnchor:
 * reduced-motion aware, lands below the nav, writes the hash with replaceState
 * and moves focus to the target.
 */
export function AnchorLink({ to, onActivate, ...rest }: AnchorLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return
    if (onActivate) {
      event.preventDefault()
      onActivate(to)
      return
    }
    if (scrollToAnchor(to)) event.preventDefault()
  }
  return <a {...rest} href={`#${to}`} onClick={onClick} />
}

/** Props of TopLink: any <a> attributes except href / onClick. */
export type TopLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick">

/**
 * The logo link: back to the top of the page. Without script it is a plain
 * link to "/"; with script a plain click scrolls up (instantly under reduced
 * motion) and drops the hash, keeping the query (`?device=`). Next's Link
 * skips its own navigation because the click is already handled.
 */
export function TopLink(props: TopLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    window.scrollTo({ top: 0, behavior: scrollBehavior() })
    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
    }
  }
  return <Link {...props} href="/" prefetch={false} onClick={onClick} />
}
