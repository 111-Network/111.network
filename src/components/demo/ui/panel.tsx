import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Heading, type HeadingLevel } from "./heading"
import { TerminalChrome } from "./terminal-chrome"

/** Elements a Panel may render as. */
export type PanelTag = "div" | "section" | "article" | "aside"

/** Props of Panel. */
export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Element to render. Default "div". */
  as?: PanelTag
  /** When set, renders the terminal-chrome header with this title. */
  title?: string
  /** Chrome label suffix, see TerminalChrome. */
  suffix?: string
  /**
   * Also expose the title as a visually hidden heading of this level, so the panel is a section in
   * the outline (the chrome bar itself is not a heading). In a view: `heading={useHeadingLevel(1)}`.
   */
  heading?: Exclude<HeadingLevel, 1>
  /** Slot at the end of the chrome bar. Ignored without a title. */
  chromeEnd?: ReactNode
  /** Terminal-body tint (`bg-secondary/20`). */
  tint?: boolean
  /** The one layered shadow (`shadow-panel`) on the card surface. */
  elevated?: boolean
  /** Drop the default body padding (tables and terminals bring their own). */
  flush?: boolean
  bodyClassName?: string
  children?: ReactNode
}

/** Bordered box, optionally with terminal chrome. Zero radius. Server-safe. */
export function Panel({
  as: Tag = "div",
  title,
  suffix,
  heading,
  chromeEnd,
  tint = false,
  elevated = false,
  flush = false,
  className,
  bodyClassName,
  children,
  ...rest
}: PanelProps) {
  return (
    <Tag {...rest} className={cn("border border-border", elevated && "bg-card shadow-panel", className)}>
      {title !== undefined ? <TerminalChrome title={title} suffix={suffix} end={chromeEnd} /> : null}
      <div className={cn(tint && "bg-secondary/20", !flush && "p-4", bodyClassName)}>
        {heading && title ? (
          <Heading level={heading} className="sr-only">
            {title}
          </Heading>
        ) : null}
        {children}
      </div>
    </Tag>
  )
}
