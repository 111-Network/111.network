// Copy for the Agent view (#/, Layers 3 and 4). Real source: os/4-interface/ui/src/views/agent/*
// (index, composer, messages, proposals, banners, state.ts) and lib/api/mock/chat.ts, in plain
// words (W1, W5; scripts/check-copy.mjs scans every literal here). The canned replies are built
// from these sentences by engine/slices/agent.ts and always tell the truth about the demo state.

/** The four starters (plan §6.3), in order. `text` is what a starter button puts in the message box. */
export const AGENT_STARTERS = [
  { id: "check", label: "check this node", text: "Check this node end to end and tell me what needs attention." },
  { id: "radio", label: "set up my radio", text: "Set up my radio and test it." },
  { id: "quiet", label: "why is the radio quiet?", text: "Why is the radio quiet?" },
  { id: "device", label: "what can this device run?", text: "What can this device run?" },
] as const

/** The real agent's fixed tools (state.ts TOOL_LINES), in plain words. A reply shows at most four. */
export const AGENT_TOOLS = {
  kb: "[reading knowledge]",
  health: "[checking health]",
  logs: "[reading logs]",
  proposal: "[writing a proposal]",
} as const

/** The chat state chip (real state.ts LABELS, without the hub and loading states the demo never has). */
export const AGENT_STATE_LABEL = {
  ready: "ready",
  starting: "starting",
  "no-model": "no model yet",
  unavailable: "unavailable",
} as const

const clause = (reason: string): string => reason.replace(/[.\s]+$/, "")

export const AGENT_COPY = {
  title: "Agent",
  chrome: { title: "agent", suffix: "chat" },

  newConversation: { short: "new", long: "new conversation", aria: "New conversation", confirm: "new conversation" },

  /** The advanced strip (real index.tsx Adv row): plain words instead of the model id. */
  advanced: {
    model: "model: small local model",
    serving: (label: string): string => `serving: ${label}`,
    conversation: (label: string): string => `conversation: ${label}`,
    copy: "copy",
    copyAria: "Copy the conversation label",
  },

  prepared: {
    from: (from: string): string => `prepared from: ${from} — edit, then send. Nothing is sent until you send it.`,
    dismiss: "dismiss",
    dismissAria: "Dismiss the prepared-prompt note",
  },

  /** One plain line while the agent cannot answer (real banners.tsx StateNotice). */
  stateNotice: {
    starting: (reason: string): string => `The agent is starting: ${clause(reason)}. Messages you send wait until it is ready.`,
    unavailable: (reason: string): string => `The agent is unavailable: ${clause(reason)}. Messages you send wait until it is ready.`,
    noModel: "There is no local model yet. Messages you send wait until one is running.",
  },

  /** The sentence shown when a message is queued instead of sent (real state.ts queuedNotice). */
  queuedNotice: {
    starting: "The agent is starting. Your message is queued and sends when it is ready.",
    noModel: "There is no local model yet. Your message is queued and sends once a model is running.",
    unavailable: (reason: string): string => `The agent is unavailable: ${clause(reason)}. Your message is queued and sends when it is back.`,
  },

  log: "Conversation",
  greeting: {
    lead: (labels: readonly string[]): string => `Ask anything about this node. Try: ${labels.map((l) => `'${l}'`).join(", ")}`,
    hint: "A button fills the message box. Nothing is sent until you send it.",
  },
  sr: { you: "You: ", agent: "Agent: ", replying: "Agent is replying: ", queued: "You, queued: " },
  stopped: "[stopped]",
  queued: { list: "Queued messages", badge: "QUEUED", remove: "remove", removeAria: "Remove this queued message" },

  composer: {
    label: "Message to the agent",
    placeholder: "Message the agent",
    hint: "Enter sends. Shift and Enter adds a new line.",
    send: "send",
    stop: "stop",
  },

  /** View-local news for the shell's live region (real session.ts announce calls). */
  announce: { replying: "agent is replying", complete: "reply complete", stopped: "reply stopped" },

  proposals: {
    section: "Open proposals",
    count: (n: number): string => (n === 1 ? "1 proposal needs you" : `${n} proposals need you`),
    details: "details",
    detailsOf: (title: string): string => ` of ${title}`,
    accept: "Accept",
    acceptConfirm: "Accept this proposal",
    dismiss: "Dismiss",
    dismissConfirm: "Dismiss this proposal",
    why: "Why?",
    blocked: (reason: string): string => `Cannot start yet: ${reason}`,
    footer: "Nothing changes on this node until you accept a proposal.",
  },

  /** A line in the transcript once a proposal the agent wrote here is decided. */
  decided: {
    accepted: (title: string): string => `You accepted: ${title}`,
    dismissed: (title: string): string => `You dismissed: ${title}`,
  },

  /** What the "Why?" button puts in the message box (real state.ts whyPrompt, without the context block). */
  whyPrompt: (title: string): string => `Explain the proposal "${title.replace(/"/g, "'")}" in plain words: what it changes, the risk, and how to undo it.`,

  /** Unknown input (plan §6.3), followed by the starters as buttons. */
  fallback: "This is a demo, I only know a few questions. Try one of these:",
} as const

/** How a service state reads inside a sentence ("Mesh link is running"). */
export const AGENT_STATE_WORD = {
  live: "is running",
  starting: "is starting",
  unset: "is not set up yet",
  error: "has a problem",
} as const

/** The canned reply sentences. Each reply is assembled from the demo state, so it never claims what is not shown. */
export const AGENT_REPLY = {
  check: {
    lead: "Your node is running.",
    problem: (name: string, reason: string): string => `${name} has a problem: ${clause(reason)}.`,
    wroteFix: "I read its log and wrote a proposal below to fix it. Nothing changes until you accept it.",
    fixWaiting: "A proposal to fix it is already waiting below.",
    internet: "It can reach the internet, so it is a gateway for the mesh while it stays online.",
    offline: "It has no internet right now, which is fine: the mesh works without it.",
    notSet: (names: string): string => `Not set up yet: ${names}.`,
    askRadio: "Ask me to set up the radio once you have a radio board.",
    waiting: (n: number): string => (n === 1 ? "One proposal is waiting for you below." : `${n} proposals are waiting for you below.`),
    clear: "Nothing else needs you right now.",
  },
  radio: {
    noBoard:
      "This node has no radio board yet, so there is nothing to set up. Plug one into a USB port; on Devices there is a demo button for that. I will ask you once before the node identifies it, offer to write firmware from the node's own signed release, and ask for your region before it ever transmits. Nothing happens to the board without your yes.",
    stage: {
      plugged: "A radio board is plugged in. Open it under Devices and allow the node to identify it, once.",
      identifying: "The node is identifying the radio board now. Wait a moment, then open it under Devices.",
      identified:
        "The board has no usable firmware yet. Open it under Devices: the node can write some from its own signed release once you type the board's name to confirm.",
      flashing: "Firmware is being written to the radio board. Leave it plugged in.",
      flashed: "Firmware is on the board. Open it under Devices and pick your region before it transmits.",
      ready: "The radio is starting. It listens on the mesh once it is running.",
    },
    running: (region: string): string => `The radio is running with the ${region} settings.`,
    bridgeOffer: "This laptop also has Wi-Fi that can host a hotspot, so it can bridge long-range radio and Wi-Fi.",
    bridgeWrote: "I wrote a proposal below to start the bridge. Nothing changes until you accept it.",
    bridgeNeedsLink: "A bridge would also need Wi-Fi that can host a hotspot, or ethernet, and this node has neither.",
    bridgeWaiting: "A proposal to start the bridge is already waiting below.",
    bridgeStarting: "The bridge is starting.",
    bridgeLive: "The bridge passes sealed traffic between long-range radio and Wi-Fi. Nothing else to set up.",
    bridgeProblem: "The bridge has a problem. Ask me to fix it.",
    problem: (reason: string): string => `The radio has a problem: ${clause(reason)}. Ask me to fix it.`,
  },
  quiet: {
    noBoard: "The radio is quiet because this node has no radio board yet: without one it cannot hear long-range radio at all.",
    tried: (networks: string): string => `The mesh link is running and tried ${networks} in order; none of them is in range.`,
    plugIn: "Plug in a radio board under Devices and it tries again.",
    notReady: "The radio board is plugged in but not set up yet, so it stays quiet: it never transmits before its region is set. Finish the steps under Devices.",
    starting: "The radio is starting. It listens on the mesh once it is running.",
    heard: (names: string): string => `It is not quiet any more. Over long-range radio this node has heard ${names}.`,
    relay: (name: string): string => `${name} is a relay: it forwards sealed traffic; it cannot read it.`,
    nearby: "Nearby shows each node as it is heard.",
    none: "The radio is running and listening, but nothing has been heard over it yet. Nodes show up under Nearby the moment they are heard.",
  },
  device: {
    lead: (facts: string): string => `This node is a laptop with ${facts}.`,
    runs: "It runs every part of the node itself: the knowledge base, updates, its own identity, the local AI and this dashboard, messaging, presence, a full encrypted store and repairs.",
    transport: "For the mesh it joins the preferred networks over Wi-Fi and Bluetooth; long-range radio needs a radio board on USB.",
    bridges: "With its radio board and Wi-Fi that can host a hotspot, it also bridges radio and Wi-Fi.",
    couldBridge: "Once a radio board is set up, its Wi-Fi hotspot would let it bridge radio and Wi-Fi too.",
    gateway: "It becomes an internet gateway whenever it gets online.",
    offload: "When a job is too heavy for it, it can ask a hub, but only over Wi-Fi or a cable, never over a long-range relay.",
  },
  layer: {
    lead: (n: number, title: string, description: string): string => `Layer ${n}, ${title}: ${description}`,
    states: (list: string): string => `On this node: ${list}.`,
    none: "It has no service of its own on this dashboard; it is part of how the whole node works.",
    setUp: (noun: string): string => `Ask me to set up the ${noun} when you are ready.`,
    nothing: "Nothing to configure right now.",
  },
  fix: {
    wrote: (name: string, reason: string): string =>
      `${name} has a problem: ${clause(reason)}. I read its log and wrote a proposal below to restart it. Nothing changes until you accept it.`,
    waiting: (name: string, reason: string): string => `${name} has a problem: ${clause(reason)}. A proposal to fix it is already waiting below.`,
    fine: (name: string, word: string): string => `Nothing to fix: ${name} ${word}.`,
    nothing: "Nothing is broken right now: every service that is set up answers its health checks.",
  },
  setup: {
    gateway: "The internet gateway is a role, not something to set up: this node becomes one by itself whenever it gets online.",
    bridgeNeedsRadio: "The bridge needs a running radio first, plus Wi-Fi that can host a hotspot, or ethernet. Ask me to set up the radio.",
    bridgeReady: "This laptop has a running radio and Wi-Fi that can host a hotspot, so it can bridge long-range radio and Wi-Fi.",
    already: (name: string, reason: string): string => `${name} is already running. ${reason}`,
    starting: (name: string): string => `${name} is starting.`,
    list: (names: string): string => `Not set up yet: ${names}. Ask me to set up one of them.`,
    wrote: "I wrote a proposal below to set it up. Nothing changes until you accept it.",
    allSet: "Everything this node can run is already set up.",
  },
  why: {
    lead: (title: string): string => `About "${title}":`,
    tail: "Nothing changes until you accept it, and dismissing it changes nothing.",
    missing: "I cannot find that proposal any more; it may have been decided already.",
  },
} as const

/** The proposals the agent writes from the chat (real `Proposal`, plain words; paragraphs split by a blank line). */
export const AGENT_PROPOSAL = {
  bridge: {
    title: "Start the bridge between long-range radio and Wi-Fi",
    body: [
      "What it changes: starts the bridge, so phones on this laptop's Wi-Fi hotspot can reach the radio mesh. It carries only the bare minimum across and never reads the payload.",
      "Risk: low. Nothing is discarded by policy; a full buffer refuses new frames until space frees, and the sender retries.",
      "Undo: dismissing it changes nothing. Once it runs, unplugging the radio board stops it.",
    ].join("\n\n"),
  },
  setup: {
    title: (noun: string): string => `Set up the ${noun}`,
    body: (noun: string): string =>
      [
        `What it changes: sets up the ${noun} on this node with its standard settings and checks that it answers health checks.`,
        "Risk: low. Nothing else on the node changes.",
        "Undo: dismissing it changes nothing.",
      ].join("\n\n"),
  },
  fix: {
    title: (noun: string): string => `Restart the ${noun}`,
    body: (noun: string): string =>
      [
        `What it changes: restarts the ${noun} from its last working settings and checks that it answers health checks again.`,
        "Risk: low. Nothing is deleted, and messages waiting on this node stay where they are.",
        "Undo: nothing to undo. If it fails again, it stays stopped and shows up here.",
      ].join("\n\n"),
  },
} as const
