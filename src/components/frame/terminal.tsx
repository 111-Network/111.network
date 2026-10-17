import { TerminalConsole } from "@/components/frame/terminal-console"
import { ANCHORS } from "@/lib/site"

// The finale terminal (plan §4.4). The heading and copy are server-rendered;
// only the terminal window itself is a client island.

const TITLE_ID = `${ANCHORS.terminal}-title`

/** Finale section #terminal: header + the interactive demo terminal. */
export function Terminal() {
  return (
    <section id={ANCHORS.terminal} aria-labelledby={TITLE_ID} className="scroll-mt-nav">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="font-mono text-sm text-muted-foreground">
              {">"}
            </span>
            <span aria-hidden="true" className="h-px w-12 bg-border" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Interactive</span>
          </div>
          <h2
            id={TITLE_ID}
            className="font-pixel-line text-3xl font-bold tracking-tight text-foreground md:text-5xl"
          >
            Terminal
          </h2>
          <p className="max-w-prose font-mono text-sm leading-relaxed text-muted-foreground">
            Walk the ten layers from the keyboard. Type a command and press Enter.
          </p>
        </div>

        <TerminalConsole />
      </div>
    </section>
  )
}
