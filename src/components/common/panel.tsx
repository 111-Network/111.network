import type { ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"

/** Elements a Panel may render as. */
export type PanelTag = "div" | "section" | "article" | "aside" | "figure"

/** Props of Panel: any div attributes plus `as`. */
export type PanelProps = ComponentPropsWithoutRef<"div"> & { as?: PanelTag }

/** The standard card surface: `border border-border bg-card shadow-panel`, zero radius. */
export function Panel({ as: Tag = "div", className, ...rest }: PanelProps) {
  return <Tag className={cn("border border-border bg-card shadow-panel", className)} {...rest} />
}
