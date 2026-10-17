// The hand-off button of Devices (real views/devices/agent-button.tsx): it puts the prepared prompt in
// the Agent's composer and opens it (core/agentPrefill). Nothing is ever sent from here. While the
// local agent is not running, the same button reveals the request instead, with a copy button, and a
// recipe (when there is one) becomes the primary action.
import { useId, useState } from "react"
import { DEVICES_COPY } from "../../copy/devices"
import { useDemo, useDispatch } from "../../engine/react"
import type { DemoState } from "../../engine/slices"
import { RouteButtonLink } from "../../shell/links"
import { Button, type ButtonVariant } from "../../ui/button"
import { FOCUS_RING_INSET } from "../../ui/classes"
import { CopyButton } from "../../ui/copy-button"

const selectAgentLive = (s: DemoState): boolean => s.core.services.find((x) => x.id === "agent")?.state === "live"

export interface AgentButtonProps {
  /** Button text while the agent is running. */
  label: string
  /** The prepared prompt: shown in the composer, never sent by itself. */
  prompt: string
  /** Short origin label for the Agent view's "prepared from" banner. */
  from: string
  variant?: ButtonVariant
  /** Route of the knowledge base recipe ("/kb/…"). With the agent down it is the primary action. */
  recipe?: string | null
  className?: string
}

export function AgentButton({ label, prompt, from, variant = "primary", recipe = null, className }: AgentButtonProps) {
  const reachable = useDemo(selectAgentLive)
  const dispatch = useDispatch()
  const [steps, setSteps] = useState<string | null>(null)
  const panelId = useId()
  const c = DEVICES_COPY.agent
  const shown = !reachable && steps !== null

  const onClick = () => {
    if (reachable) {
      dispatch({ type: "core/agentPrefill", text: prompt, from })
      return
    }
    setSteps((open) => (open === null ? prompt : null))
  }

  const recipeFirst = !reachable && recipe !== null
  return (
    <div className={className}>
      <div className="flex flex-wrap items-start gap-3">
        {recipeFirst ? (
          <RouteButtonLink variant="primary" to={recipe}>
            {c.recipe}
          </RouteButtonLink>
        ) : null}
        <Button
          variant={recipeFirst ? "default" : variant}
          onClick={onClick}
          aria-expanded={reachable ? undefined : shown}
          aria-controls={reachable ? undefined : panelId}
        >
          {reachable ? label : shown ? c.hide : c.show}
        </Button>
      </div>
      <div id={panelId} hidden={!shown} className="mt-3 max-w-prose">
        {shown ? (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              {c.down} {recipe !== null ? `${c.recipeNote} ` : ""}
              {c.tail}
            </p>
            <pre
              tabIndex={0}
              className={`max-h-64 overflow-auto whitespace-pre-wrap break-words border border-border bg-secondary/20 p-3 font-mono text-xs leading-relaxed text-muted-foreground ${FOCUS_RING_INSET}`}
            >
              {steps}
            </pre>
            <CopyButton text={steps} label={c.copy} ariaLabel={c.copyAria} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
