// The view title of Messages and of a conversation (ui/section-header's look), with a heading that
// can take the focus: when the visitor moves inside this view (list -> conversation and back) or a
// step swaps the controls under it, focus lands here (DEMO-CONTRACT §4). Level from the shell.
import type { ReactNode, Ref } from "react"
import { useHeadingLevel } from "../../shell/context"

export function ViewHeader({ kicker, title, end, headingRef }: { kicker: string; title: string; end?: ReactNode; headingRef?: Ref<HTMLHeadingElement> }) {
  const level = useHeadingLevel()
  const Tag = `h${level}` as const
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{kicker}</span>
        <Tag ref={headingRef} tabIndex={-1} className="mt-1 break-words font-pixel-line text-2xl font-bold text-foreground outline-none @min-[768px]:text-3xl">
          {title}
        </Tag>
      </div>
      {end ? <div className="shrink-0">{end}</div> : null}
    </header>
  )
}
