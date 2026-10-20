// Copy for the service page template (#/services/<id> for the Local AI agent, Local model, Mesh link,
// Long-range radio, Knowledge base and Messaging; the Internet gateway, Bridge, Storage and Repairs have
// their own pages). Owned by the services-template task. Real wording: os/4-interface/ui/src/views/services/
// index.tsx + model.ts, minus everything API-specific (no technical names, ports, ids, versions or
// reason codes). Plain words only (W1, W5); scripts/check-copy.mjs scans every literal here.
import type { NetworkTry, RadioStage } from "../engine/types"

/** How a service runs (real `KIND_LABEL`, in plain words). */
export type ServiceKindWord = "child" | "detected" | "builtin"

export const SERVICES_COPY = {
  /** Details | Log (real tabs.tsx "Details" | "Panel"; the demo has no hosted panels, so the log takes the second tab). */
  tabs: {
    label: (name: string): string => `${name} sections`,
    details: "Details",
    log: "Log",
  },

  /** The control panel (real ControlPanel). */
  panel: {
    suffix: "control panel",
    heading: "Control panel",
  },

  /** Restart (real RestartControl + restartButtonLabel). */
  restart: {
    label: "Restart",
    busy: "Restarting…",
    confirm: (name: string): string => `Restart ${name}`,
    /** The event sentence the shell announces (real `announce(\`Restarting ${plain_name}.\`)`). */
    event: (name: string): string => `Restarting ${name}.`,
    /** The line it leaves in the service's log. */
    logged: "Restart asked for from the dashboard.",
  },

  /** The sample log (real log.tsx LogTail). */
  log: {
    suffix: "demo log",
    note: "Sample lines. The times follow the demo's own clock, and new lines come only from what you do here.",
    /** A state change: "LIVE · Running and answering health checks." */
    stateLine: (state: string, reason: string): string => `${state} · ${reason}`,
  },

  /** "Runs as" (real KIND_LABEL: runs as a program / detected / built in). */
  kind: {
    child: "a program this node starts and looks after",
    detected: "hardware this node detects",
    builtin: "part of the node itself",
  } satisfies Record<ServiceKindWord, string>,

  /** Fact labels shared by every service. */
  facts: {
    does: "What it does",
    runsAs: "Runs as",
    lastChange: "Last change",
    lastChangeValue: (day: string, clock: string): string => `${day}, ${clock}`,
  },

  agent: {
    does: "Answers your questions about this node and writes proposals you can accept or dismiss.",
    thinksWith: "Thinks with",
    reads: "Reads",
    readsValue: "the knowledge base and this node's health",
    tools: "Tools",
    toolsValue: "reading knowledge, checking health, reading logs, writing a proposal",
    cannot: "Cannot",
    cannotValue: "touch hardware or run commands",
    proposals: "Proposals waiting",
    proposalsValue: (n: number): string => (n === 0 ? "none" : String(n)),
    openChat: "open the chat",
  },

  model: {
    does: "Gives the agent its words, and nothing you type leaves this node.",
    runsOn: "Runs on",
    runsOnValue: (device: string): string => `this ${device} alone, so chat works without the internet`,
    consent: "Your consent",
    consentValue: "given",
    usedBy: "Used by",
  },

  mesh: {
    does: "Finds other nodes on the preferred networks and carries sealed messages to them, with no central server.",
    joined: "Joined",
    joinedValue: (network: string, medium: string): string => `${network}, over ${medium}`,
    joinedNone: "none yet: no preferred network is in range",
    network: (medium: string, attempt: NetworkTry): string => `${medium} · ${attempt}`,
    heard: "Heard over the mesh",
    heardNone: "nobody yet",
    openNearby: "open Nearby",
    reads: "Can read messages",
    readsValue: "no: it carries them sealed",
  },

  radio: {
    /** Shown once a board is plugged in and until its region is picked: the steps live on its device page. */
    continue: "Set up the board on its page",
    does: "Lets this node reach nodes far away, with no Wi-Fi and no internet.",
    board: "Radio board",
    boardNone: "none plugged in",
    /** The board's stage in plain words. */
    stage: {
      plugged: "plugged in, waiting for your OK",
      identifying: "being identified",
      identified: "identified, no usable firmware yet",
      flashing: "firmware being written",
      flashed: "firmware on, no region yet",
      ready: "set up",
    } satisfies Record<RadioStage, string>,
    region: "Region",
    regionNone: "not picked yet",
    transmits: "Transmits",
    transmitsLive: (region: string): string => `yes, with the ${region} settings`,
    transmitsNot: "not yet: only once the board is set up and a region is picked",
  },

  kb: {
    does: "Gives the agent recipes and notes to answer from, even with no internet.",
    offline: "Works offline",
    offlineValue: "yes",
    check: "Check",
    checkValue: {
      live: "verified against the node's signed release",
      starting: "being checked",
      error: "failed its check",
      unset: "not checked yet",
    },
    grades: "Grades",
    gradesValue: "each note carries a grade: candidate, testing or proven",
    notes: "Notes",
    openKb: "open the knowledge base",
  },

  messaging: {
    does: "Carries sealed messages between you and your contacts, so only the two ends can read them.",
    hub: "Home hub",
    hubValue: (hub: string): string => `${hub}, over Wi-Fi`,
    store: "Store",
    storeValue: "encrypted, on this node",
    states: "Delivery states",
    statesValue: "queued, sent, relayed, delivered",
    delivered: "Delivered means",
    deliveredValue: "the other node acknowledged it",
    conversations: "Conversations",
    openMessages: "open Messages",
  },

  /** The sample history each log opens with (the hours before the demo opened, on the demo's clock). */
  history: {
    agent: {
      started: "Started by the node.",
      kb: "Read the knowledge base.",
      model: "The local model answers.",
      health: "Health check answered.",
    },
    model: {
      loading: "Loading the model, with your consent.",
      loaded: "Model loaded. Everything stays on this node.",
      health: "Health check answered.",
      turn: "Answered a question for the agent.",
    },
    mesh: {
      started: "Started by the node. Trying the preferred networks in order.",
      tried: (network: string, medium: string): string => `${network} over ${medium}: no signal.`,
      triedNoBoard: (network: string, medium: string): string => `${network} over ${medium}: no signal. There is no radio board yet.`,
      none: "None of the preferred networks is in range yet.",
    },
    radio: {
      none: "Looked for a radio board on USB: none found.",
      quiet: "Nothing goes out over radio until a board is set up and a region is picked.",
    },
    kb: {
      opened: "Opened the knowledge base that ships with this node.",
      verified: "Checked it against the node's signed release: verified.",
      ready: "Ready for the agent, with no internet needed.",
    },
    messaging: {
      opened: "Opened the encrypted message store.",
      hub: (hub: string): string => `${hub}, your home hub, is reachable over Wi-Fi.`,
      ready: "Messages are delivered, or held for you by your home hub.",
    },
  },
} as const
