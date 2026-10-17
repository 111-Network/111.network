// The service page state matrix (real views/services/model.ts servicePageState), for the shared
// ServicePageFrame. Pure: no React, tested in node.
//   live        the page's own body (control panel, actions)
//   starting    the same, with an honest "not answering yet" line
//   unset       what it needs, and "Set up with the agent" (none when it turns live by itself)
//   unavailable this device cannot run it: what it needs, no button
//   error       the reason, and "Fix with the agent"
import { HANDOFF, SERVICE_NOUN } from "../copy/core"
import { PATHS } from "../engine/router"
import type { ServiceId } from "../engine/types"
import type { DemoService } from "../engine/world"
import { SHELL_COPY } from "./copy"

export type ServiceBody = "live" | "starting" | "unset" | "unavailable" | "error"

export interface ServiceHandoff {
  goal: "setup" | "fix"
  label: string
}

export interface ServicePageState {
  body: ServiceBody
  handoff: ServiceHandoff | null
  /** Route of the knowledge base recipe ("/kb/<drawer>/<note>"), or null. */
  recipePath: string | null
}

/** "recipes/set-up-a-radio-board" -> "/kb/recipes/set-up-a-radio-board"; malformed -> null. */
export function kbRouteOf(entry: string | null): string | null {
  if (!entry) return null
  const i = entry.indexOf("/")
  if (i <= 0 || i === entry.length - 1) return null
  return PATHS.kbNote(entry.slice(0, i), entry.slice(i + 1))
}

export function servicePageState(service: Pick<DemoService, "state" | "canRunHere" | "setup" | "kb">): ServicePageState {
  const body: ServiceBody =
    service.state === "live"
      ? "live"
      : service.state === "starting"
        ? "starting"
        : service.state === "error"
          ? "error"
          : service.canRunHere
            ? "unset"
            : "unavailable"
  let handoff: ServiceHandoff | null = null
  if (body === "unset" && service.setup === "agent") handoff = { goal: "setup", label: HANDOFF.setup }
  else if (body === "error") handoff = { goal: "fix", label: HANDOFF.fix }
  return { body, handoff, recipePath: kbRouteOf(service.kb) }
}

/** The prepared prompt of a hand-off (real lib/prompts.ts goalSentence): shown in the composer, never sent by itself. */
export function handoffPrompt(goal: ServiceHandoff["goal"], id: ServiceId): string {
  const noun = SERVICE_NOUN[id]
  return goal === "setup" ? SHELL_COPY.service.setupPrompt(noun) : SHELL_COPY.service.fixPrompt(noun)
}
