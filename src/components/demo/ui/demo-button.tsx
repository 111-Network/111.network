import { Button, type ButtonProps } from "./button"
import { DemoTag } from "./demo-tag"

/** Props of DemoButton: every Button prop; `size` defaults to "sm". */
export type DemoButtonProps = ButtonProps

/**
 * A contextual demo action inside the view where it makes sense, never a popup menu (plan §6.3):
 * `<DemoButton onClick={…}>plug in a radio board</DemoButton>` renders `[DEMO] plug in a radio board`.
 * Render it from a client component (it takes a handler).
 */
export function DemoButton({ size = "sm", children, ...rest }: DemoButtonProps) {
  return (
    <Button size={size} {...rest}>
      <DemoTag />
      <span>{children}</span>
    </Button>
  )
}
