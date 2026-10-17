// In-demo links (real views/services/shared.tsx RouteLink + components/button.tsx ButtonLink). Both
// are real <a> elements whose href works on its own (a new tab opens the full /demo there); a plain
// left click navigates through the store instead (DemoLink), so the url router never sees a raw hash.
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { DemoLink, type DemoLinkProps } from "../engine/react"
import { ARROW_CLASS, buttonClasses, showsArrow, type ButtonSize, type ButtonVariant } from "../ui/button-classes"
import { FOCUS_RING } from "../ui/classes"

/** The underlined in-text link of the dashboard. */
export const LINK_CLASS = cn("text-foreground underline underline-offset-4 hover:bg-foreground hover:text-background", FOCUS_RING)

/** A text link to a route: `<RouteLink to={PATHS.service("radio")}>Long-range radio</RouteLink>`. */
export function RouteLink({ className, ...rest }: DemoLinkProps) {
  return <DemoLink {...rest} className={cn(LINK_CLASS, className)} />
}

export interface RouteButtonLinkProps extends DemoLinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Trailing `->`; defaults to true for primary. */
  arrow?: boolean
  children?: ReactNode
}

/** A link to a route that looks like a Button: `<RouteButtonLink to={PATHS.overview} size="sm">Go to Overview</RouteButtonLink>`. */
export function RouteButtonLink({ variant = "default", size = "md", arrow, className, children, ...rest }: RouteButtonLinkProps) {
  return (
    <DemoLink {...rest} className={buttonClasses({ variant, size, className })}>
      {children}
      {showsArrow(variant, arrow) ? (
        <span aria-hidden="true" className={ARROW_CLASS}>
          {"->"}
        </span>
      ) : null}
    </DemoLink>
  )
}
