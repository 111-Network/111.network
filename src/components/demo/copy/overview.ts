// Copy for the Overview view (#/overview, where /demo opens). Owned by the Overview view task.
// Every user-visible sentence of the view lives here, in plain words (W1, W5; scripts/check-copy.mjs
// scans these literals). Mirrors the real dashboard's wording (os/4-interface/ui/src/views/overview/*,
// lib/prompts.ts) minus everything API-specific. The verdict, nearby, needs-you and device sentences
// are shared and live in copy/core.ts (VERDICT_COPY, NEARBY_SENTENCE, NEEDS_COPY, DEVICE_COPY).
// No identity-backup command and no recovery-word count (plan §6.8).

export const OVERVIEW_COPY = {
  kicker: "overview",

  /** The two hand-offs to the agent (real lib/prompts.ts goalSentence "check" and "setup"). Never sent by themselves. */
  ask: {
    /** The banner of the prepared prompt: "prepared from: Overview". */
    from: "Overview",
    check: "Let the agent check this node",
    checkPrompt: "Check this node end to end and tell me what needs attention.",
    /** Same sentence as a service page's "Set up with the agent" (shell/service-page handoffPrompt). */
    setupPrompt: (noun: string): string => `Set up the ${noun} on this node and test it.`,
    note: "This opens the agent with a prepared message. Nothing is sent until you send it.",
  },

  /** The "needs you" block (real NeedsYouPanel). */
  needs: {
    heading: "Needs you",
    chrome: "needs you",
    /** The small label above each row (a NOT SET row is a service that can be set up now). */
    kind: { proposal: "proposal", request: "messages", service: "service", device: "device", setup: "service" },
    nothing: "Nothing needs you right now.",
    checklist: "first-run checklist",
    checklistSummary: (done: number, total: number, unknown: number): string =>
      `First-run checklist · ${done} of ${total} done${unknown > 0 ? ` · ${unknown} unknown` : ""}`,
    open: "open",
  },

  /**
   * The checklist row the real dashboard leads with. Layer 2 has no "backed up" marker, so it stays
   * honestly unknown; the backup itself happens on the node (Settings L2), never through a command here.
   */
  identity: {
    title: "Identity backup",
    text: "back up any time from the node itself",
  },

  nearby: {
    heading: "Nearby",
    chrome: "nearby",
    /** One heard node: "over long-range radio". */
    via: (medium: string): string => `over ${medium}`,
    /** Plan §6.8, verbatim. */
    relay: "forwards sealed traffic; cannot read it",
    /** The home hub heard over this Wi-Fi is the home link, listed apart from the mesh. */
    homeHub: (name: string): string => `${name}, your home hub, answered over this Wi-Fi. That is the home link, not a nearby node on the mesh.`,
    link: "See who is nearby",
  },

  devices: {
    heading: "Devices",
    chrome: "devices",
    link: "Manage devices",
  },

  services: {
    heading: "services",
    elsewhere: (n: number): string => `not available on this device (${n})`,
  },

  /** The node spec table (real nodeFacts). Plain words; no node address, no hostnames. */
  node: {
    heading: "Node",
    chrome: "node",
    rows: {
      label: "Label",
      name: "Name",
      device: "Device",
      hardware: "Hardware",
      version: "Version",
      uptime: "Uptime",
      updates: "Updates",
      lastCheck: "Last update check",
      gateway: "Internet gateway",
      dashboard: "Dashboard",
    },
    copyLabel: "Copy the label",
    upToDate: "up to date",
    never: "never",
    gateway: { live: "internet reachable", starting: "checking", none: "no internet" },
    dashboard: "this device only",
  },

  activity: {
    heading: "activity",
    title: "activity",
    empty: "Nothing has happened on this page yet. It shows up here when you chat with the agent, plug something in or accept a proposal.",
    advanced: "advanced",
    all: "all events",
    allEmpty: "No events on this page yet.",
  },
} as const
