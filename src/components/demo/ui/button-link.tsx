import type { AnchorHTMLAttributes } from "react"
import { ARROW_CLASS, buttonClasses, showsArrow, type ButtonSize, type ButtonVariant } from "./button-classes"

/** Props of ButtonLink: any anchor attributes plus the options below. */
export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Trailing `->`. Defaults to true for `primary`. */
  arrow?: boolean
  /** Opens in a new tab with `noopener noreferrer`. Used for link-outs, never an iframe. */
  external?: boolean
}

/**
 * A link that looks like a Button (hash-route navigation, link-outs). Server-safe without an
 * `onClick`; the demo shell passes one to route in-page links through its store.
 */
export function ButtonLink({ variant = "default", size = "md", arrow, external = false, className, children, ...rest }: ButtonLinkProps) {
  return (
    <a
      {...rest}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={buttonClasses({ variant, size, className })}
    >
      {children}
      {showsArrow(variant, arrow) ? (
        <span aria-hidden="true" className={ARROW_CLASS}>
          {"->"}
        </span>
      ) : null}
      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </a>
  )
}
