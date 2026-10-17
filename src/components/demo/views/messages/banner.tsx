// The one line above Messages and a conversation while the Messaging service is not LIVE (real
// views/messages/banner.tsx; interface README 7.2). The sentence is the service's own reason; the
// agent button hands the prepared question to the agent (it lands in the composer, never sent by
// itself), and "Messaging settings" opens the Layer 5 page.
import { MESSAGES_COPY } from "../../copy/messages"
import { useDemo, useDispatch } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { RouteButtonLink } from "../../shell/links"
import { Button } from "../../ui/button"
import { LABEL_CLASS } from "../../ui/classes"
import { StatusDot } from "../../ui/status-dot"
import { messagingBanner } from "./model"
import { selectMessagingService } from "./select"

export function MessagingBanner() {
  const service = useDemo(selectMessagingService)
  const dispatch = useDispatch()
  const banner = messagingBanner(service)
  if (!banner || !service) return null
  const agent = banner.agent
  return (
    <div className="flex flex-col gap-3 border border-border p-4" data-testid="messaging-banner">
      <div className="flex flex-wrap items-center gap-3">
        <p className={LABEL_CLASS}>{banner.kicker}</p>
        <StatusDot state={service.state} name={service.name} />
      </div>
      <p className="max-w-prose font-mono text-sm leading-relaxed text-foreground">{banner.text}</p>
      {agent ? (
        <div className="flex flex-wrap items-start gap-3">
          <Button
            variant={agent.primary ? "primary" : "default"}
            onClick={() => dispatch({ type: "core/agentPrefill", text: agent.question, from: MESSAGES_COPY.banner.from })}
          >
            {agent.label}
          </Button>
          <RouteButtonLink to={PATHS.settingsLayer(5)}>{MESSAGES_COPY.banner.settings}</RouteButtonLink>
        </div>
      ) : null}
    </div>
  )
}
