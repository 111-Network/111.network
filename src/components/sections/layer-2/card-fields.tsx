import { Fragment } from "react"
import { KeyBars } from "./key-bars"
import { NODE_KEY } from "./model"
import { Seal } from "./seal"

// Server Component: the static fields printed on the ID card. The bench (a
// client island) receives it as a prop and wraps it with the decoding label.

const DT = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

const NOT_NEEDED = ["phone", "email", "registry"] as const

/** The card's printed fields below the label, then its own seal. */
export function CardFields() {
  return (
    <>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-t border-border px-4 py-4 font-mono text-xs">
        <dt className={DT}>public half</dt>
        <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <KeyBars keyId={NODE_KEY} label="public half: the node's own key" />
          <span className="text-[10px] text-muted-foreground">shared with peers</span>
        </dd>

        <dt className={DT}>private half</dt>
        <dd className="flex items-center gap-3">
          <span aria-hidden="true" className="h-4 min-w-8 max-w-28 flex-1 bg-foreground" />
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest">stays here</span>
        </dd>

        <dt className={DT}>issued by</dt>
        <dd className="font-bold">nobody</dd>

        {NOT_NEEDED.map((field) => (
          <Fragment key={field}>
            <dt className={DT}>
              <s className="decoration-foreground">{field}</s>
            </dt>
            <dd className="text-muted-foreground">not needed</dd>
          </Fragment>
        ))}

        <dt className={DT}>backup</dt>
        <dd>optional · works without one</dd>
      </dl>

      {/* The card's own seal, fixed. The peer's changing reading of it
          (VOUCHED / BROKEN / WRONG KEY) lives on the copy it hears. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3">
        <Seal state="vouched" word="sealed" />
        <span className="font-mono text-[10px] text-muted-foreground">by its own key</span>
      </div>
    </>
  )
}
