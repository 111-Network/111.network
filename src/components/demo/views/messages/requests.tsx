// Pending message requests (real views/messages/requests.tsx; os/5-messaging/README.md §7.2): the held
// words as text only, and what a person can do with them.
//
//   accept          makes the contact; the held words stay in the thread, and it can be written to.
//   ignore          moves the request out of the way on THIS device: it stays pending on the node,
//                   is listed under "ignored requests", leaves the badge, and nothing is sent.
//   forget request  discards the request and its held words, behind the inline two-step confirm.
//
// The request is sample data, so the row carries the "demo message" note. There are no pair codes
// and no lockouts (plan §6.8). Request actions emit no store event, so the row announces them.
import type { RefObject } from "react"
import { MESSAGES_COPY } from "../../copy/messages"
import { useDispatch, useNavigate } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { useAnnounce } from "../../shell/context"
import { RouteLink } from "../../shell/links"
import { Button } from "../../ui/button"
import { LABEL_CLASS } from "../../ui/classes"
import { DemoNote } from "../../ui/demo-note"
import { Disclosure } from "../../ui/disclosure"
import type { HeadingLevel } from "../../ui/heading"
import type { RequestItem } from "./model"

const C = MESSAGES_COPY
const NOTE = "max-w-prose font-mono text-xs leading-relaxed text-muted-foreground"

export type RequestOutcome = "accepted" | "ignored" | "restored" | "forgotten"

export interface RequestRowProps {
  item: RequestItem
  /** Show the held words (the list does; the conversation shows them as a message instead). */
  showPreview?: boolean
  /** Open the conversation after accepting (the list does; the conversation stays put). */
  openAfterAccept?: boolean
  /** Called after an action, so the caller can move focus when the row moves or goes. */
  onDone?: (outcome: RequestOutcome) => void
}

export function RequestRow({ item, showPreview = true, openAfterAccept = false, onDone }: RequestRowProps) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const { peer, label, ignored } = item

  const accept = () => {
    dispatch({ type: "messages/acceptRequest", peer })
    announce(C.announce.accepted(label))
    onDone?.("accepted")
    if (openAfterAccept) navigate(PATHS.conversation(peer))
  }
  const toggleIgnored = () => {
    dispatch({ type: ignored ? "messages/restoreRequest" : "messages/ignoreRequest", peer })
    announce(ignored ? C.announce.restored(label) : C.announce.ignored(label))
    onDone?.(ignored ? "restored" : "ignored")
  }
  const forget = () => {
    dispatch({ type: "messages/forgetRequest", peer })
    announce(C.announce.forgotten(label))
    onDone?.("forgotten")
  }

  return (
    <li className="flex flex-col gap-2 border-b border-border px-4 py-3 font-mono last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <RouteLink to={PATHS.conversation(peer)} className="inline-flex min-h-11 min-w-0 items-center break-all text-sm">
          {label}
          <span className="sr-only">{C.requestLinkHint}</span>
        </RouteLink>
        <DemoNote />
      </div>
      {showPreview ? (
        <p dir="auto" className="max-w-prose whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
          {item.preview}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" arrow={false} onClick={accept}>
          {C.accept}
          <span className="sr-only">{C.requestFrom(label)}</span>
        </Button>
        <Button size="sm" onClick={toggleIgnored}>
          {ignored ? C.showAgain : C.ignore}
          <span className="sr-only">{C.requestFrom(label)}</span>
        </Button>
        <Button size="sm" variant="destructive" confirm={C.forgetConfirm} onClick={forget}>
          {C.forget}
          <span className="sr-only">{C.fromLabel(label)}</span>
        </Button>
      </div>
    </li>
  )
}

/** The framing sentence above a list of requests (real REQUEST_NOTE, verbatim). */
export function RequestNote() {
  return <p className={NOTE}>{C.requestNote}</p>
}

export interface RequestsSectionProps {
  items: readonly RequestItem[]
  level: HeadingLevel
  headingId: string
  headingRef: RefObject<HTMLHeadingElement | null>
  onDone?: (outcome: RequestOutcome) => void
}

/**
 * The "message requests" block (real RequestsSection): the requests that need an answer, then the
 * ones ignored on this device folded under a disclosure (still pending, still acceptable).
 */
export function RequestsSection({ items, level, headingId, headingRef, onDone }: RequestsSectionProps) {
  if (items.length === 0) return null
  const shown = items.filter((i) => !i.ignored)
  const folded = items.filter((i) => i.ignored)
  const Tag = `h${level}` as const
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <Tag id={headingId} ref={headingRef} tabIndex={-1} className={`${LABEL_CLASS} outline-none`}>
        {C.requestsHeading(shown.length)}
      </Tag>
      <RequestNote />
      {shown.length > 0 ? (
        <ul className="border border-border">
          {shown.map((i) => (
            <RequestRow key={i.peer} item={i} openAfterAccept onDone={onDone} />
          ))}
        </ul>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">{C.noNewRequests}</p>
      )}
      {folded.length > 0 ? (
        <Disclosure summary={C.ignoredSummary(folded.length)}>
          <div className="flex flex-col gap-2">
            <p className={NOTE}>{C.ignoredNote}</p>
            <ul className="border border-border">
              {folded.map((i) => (
                <RequestRow key={i.peer} item={i} openAfterAccept onDone={onDone} />
              ))}
            </ul>
          </div>
        </Disclosure>
      ) : null}
    </section>
  )
}
