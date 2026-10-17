// The stand-in body of a view module that its view task has not filled yet (the shell is navigable
// before every view lands). It uses the real primitives and names the view; each view task replaces
// its own views/<name>/index.tsx and drops this import.
import type { ReactNode } from "react"
import { Panel } from "../ui/panel"
import { SectionHeader } from "../ui/section-header"
import { useHeadingLevel } from "./context"
import { SHELL_COPY } from "./copy"

export interface ViewPlaceholderProps {
  kicker: string
  title: string
  children?: ReactNode
}

export function ViewPlaceholder({ kicker, title, children }: ViewPlaceholderProps) {
  const level = useHeadingLevel()
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader level={level} kicker={kicker} title={title} />
      {children}
      <Panel title={kicker} suffix="view">
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">{SHELL_COPY.view.placeholder}</p>
      </Panel>
    </div>
  )
}
