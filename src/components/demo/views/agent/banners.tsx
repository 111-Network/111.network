// The strips around the transcript (real views/agent/banners.tsx): the prepared-prompt banner and
// the one-line state notice. The real no-model offer card is left out: the demo's model is always
// installed, so a missing model only shows as the notice.
import { AGENT_COPY } from "../../copy/agent"
import { Button } from "../../ui/button"

export function PreparedBanner({ from, onDismiss }: { from: string; onDismiss: () => void }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1">{AGENT_COPY.prepared.from(from)}</span>
      <Button size="sm" onClick={onDismiss} aria-label={AGENT_COPY.prepared.dismissAria} className="@min-[1024px]:min-h-8">
        {AGENT_COPY.prepared.dismiss}
      </Button>
    </div>
  )
}

/** One plain line while the agent cannot answer, so the reason is visible without opening its page. */
export function StateNotice({ text }: { text: string | null }) {
  if (!text) return null
  return <p className="shrink-0 border-b border-border px-4 py-2 text-xs text-muted-foreground">{text}</p>
}
