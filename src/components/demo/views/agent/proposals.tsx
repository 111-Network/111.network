// Open proposals as inline cards in the conversation (real views/agent/proposals.tsx): title, kind,
// age, the body behind a disclosure, and Accept / Dismiss / Why?. Accept and Dismiss use the real
// two-step inline confirm. Accept dispatches core/proposalAccepted: the target goes STARTING -> LIVE
// and the header badge and "needs you" change in the same dispatch. Core refuses an Accept whose
// target cannot start yet; the card then says why, and the shell announces the refusal.
import { memo } from "react"
import { AGENT_COPY } from "../../copy/agent"
import { agoText } from "../../engine/clock"
import type { DemoProposal } from "../../engine/core"
import { useDemo, useWorld } from "../../engine/react"
import { selectCore } from "../../engine/selectors"
import { proposalBlocked } from "../../engine/slices/agent"
import { selectNow } from "../../shell/select"
import { Badge } from "../../ui/badge"
import { Button } from "../../ui/button"
import { DemoNote } from "../../ui/demo-note"
import { Disclosure } from "../../ui/disclosure"

const C = AGENT_COPY.proposals

export type Decision = "accepted" | "dismissed"

interface CardProps {
  proposal: DemoProposal
  now: number
  blocked: string | null
  onDecide: (id: string, decision: Decision) => void
  onWhy: (title: string) => void
}

function ProposalCard({ proposal, now, blocked, onDecide, onWhy }: CardProps) {
  return (
    <li className="border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 break-words text-sm text-foreground">{proposal.title}</p>
        <Badge>{proposal.kind}</Badge>
        <span className="text-[10px] text-muted-foreground">{agoText(proposal.createdAt, now)}</span>
        <DemoNote kind="reply" />
      </div>
      <Disclosure
        summary={
          <>
            {C.details}
            <span className="sr-only">{C.detailsOf(proposal.title)}</span>
          </>
        }
        className="mt-1"
      >
        <div className="flex flex-col gap-2 border border-border bg-secondary/20 p-3 text-xs leading-relaxed text-foreground">
          {proposal.body.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </Disclosure>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" arrow={false} confirm={C.acceptConfirm} onClick={() => onDecide(proposal.id, "accepted")}>
          {C.accept}
        </Button>
        <Button size="sm" confirm={C.dismissConfirm} onClick={() => onDecide(proposal.id, "dismissed")}>
          {C.dismiss}
        </Button>
        <Button size="sm" onClick={() => onWhy(proposal.title)}>
          {C.why}
        </Button>
      </div>
      {blocked ? <p className="mt-2 text-xs text-muted-foreground">{C.blocked(blocked)}</p> : null}
    </li>
  )
}

export interface ProposalCardsProps {
  /** Open proposals (every source: the chat, repairs …), oldest first. */
  proposals: readonly DemoProposal[]
  onDecide: (id: string, decision: Decision) => void
  onWhy: (title: string) => void
}

export const ProposalCards = memo(function ProposalCards({ proposals, onDecide, onWhy }: ProposalCardsProps) {
  const now = useDemo(selectNow)
  const core = useDemo(selectCore)
  const world = useWorld()
  if (proposals.length === 0) return null
  return (
    <section aria-label={C.section} className="shrink-0 border border-border bg-secondary/20 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{C.count(proposals.length)}</p>
      <ul className="flex flex-col gap-2">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} now={now} blocked={proposalBlocked(core, world, p)} onDecide={onDecide} onWhy={onWhy} />
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">{C.footer}</p>
    </section>
  )
})
