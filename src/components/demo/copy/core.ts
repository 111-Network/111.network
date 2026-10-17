// Core copy of the /demo dashboard: the frame strip, demo notes, the cast, the service registry,
// the verdict and needs-you sentences, event lines and the layer pages. Plain words only (W1, W5):
// no tech names, no category codes, no hardware numbers. scripts/check-copy.mjs scans every
// literal here. View copy lives in copy/<view>.ts; this file is shared by all of them.
import type { CastId, KnownCause, Medium, NetworkId, RadioStage, ServiceId } from "../engine/types"

// ------------------------------------------------------------------------------------- frame

/** The one 10px strip under the site bar (plan §6.2). */
export const FRAME_STRIP = "DEMO · sample data · nothing leaves this page"

/** The small note every incoming demo item carries (W14). */
export const DEMO_NOTE = {
  /** On every incoming message and notification. */
  message: "demo message",
  /** On every agent reply. */
  reply: "demo reply",
  /** On every node heard on the radar or in the list. */
  node: "demo node",
} as const

/** The tag on contextual demo buttons: `[DEMO] plug in a radio board`. */
export const DEMO_TAG = "DEMO"

/** The contextual demo buttons (plan §6.3). Shared, because two views can offer the same one. */
export const DEMO_ACTIONS = {
  plugRadio: "plug in a radio board",
  fault: "simulate a fault",
  internet: "connect to the internet",
  fetchMap: "fetch the regional map",
  updates: "check for updates",
  listen: "listen for a minute",
} as const

// -------------------------------------------------------------------------------------- cast

export interface CastCopy {
  name: string
  blurb: string
}

export const CAST_COPY: Readonly<Record<CastId, CastCopy>> = {
  "workshop-laptop": { name: "Workshop laptop", blurb: "This node: a laptop on the workshop bench." },
  ada: { name: "Ada", blurb: "Ada's own node, an old phone she keeps with her." },
  bram: { name: "Bram", blurb: "Bram's own node, a small box with a radio, out past the ridge." },
  "workshop-hub": {
    name: "Workshop hub",
    blurb: "Your home hub. It stays on, holds sealed copies for nodes that are away and keeps the big shared libraries.",
  },
  "ridge-repeater": { name: "Ridge repeater", blurb: "A relay on the ridge. It forwards sealed traffic; it cannot read it." },
  "valley-hub": { name: "Valley hub", blurb: "A hub down the valley, reached over long-range radio." },
}

/** The node chip badge: plain device words, never a category code (plan §6.5 rule 5). */
export const OWN_BADGE = "LAPTOP"

/** This laptop's facts, in plain words and with no numbers. */
export const OWN_FACT_LINES = {
  wifi: "Wi-Fi that can host a hotspot",
  bluetooth: "Bluetooth",
  usb: "USB ports",
  noEthernet: "no ethernet port",
  noRadio: "no radio board yet",
  radio: "a radio board on USB",
} as const

// ---------------------------------------------------------------------------------- networks

export const MEDIUM_LABEL: Readonly<Record<Medium, string>> = {
  wifi: "Wi-Fi",
  bluetooth: "Bluetooth",
  radio: "long-range radio",
  internet: "internet",
}

export const NETWORK_COPY: Readonly<Record<NetworkId, { name: string; medium: string }>> = {
  "network-a": { name: "Network A", medium: "long-range radio" },
  "network-b": { name: "Network B", medium: "Wi-Fi" },
  "network-c": { name: "Network C", medium: "Bluetooth" },
}

/** Radio regions offered after flashing. Plain place names only. */
export const REGIONS = ["Europe", "North America", "South America", "Asia", "India", "Australia and New Zealand"] as const

// ---------------------------------------------------------------------------------- services

export interface ServiceCopy {
  name: string
  /** 2–3 plain sentences: what it is. */
  description: string
  /** What it needs, or null. */
  requires: string | null
  /** The reason sentence per state when nothing more specific applies. */
  reasons: { live: string; unset: string; starting: string; error: string }
}

const STARTING = "Starting up."
const STOPPED = "Stopped answering health checks."

export const SERVICE_COPY: Readonly<Record<ServiceId, ServiceCopy>> = {
  agent: {
    name: "Local AI agent",
    description:
      "A small assistant that runs on this node. It reads the built-in knowledge base and the node's health, answers your questions, and writes proposals you can accept or dismiss. It cannot touch hardware or run commands.",
    requires: "A local model on this node, or a nearby hub's.",
    reasons: { live: "Running and answering health checks.", unset: "Not set up yet.", starting: STARTING, error: "The agent stopped answering health checks." },
  },
  model: {
    name: "Local model",
    description: "The language model the agent thinks with. It runs entirely on this node, so chat works without the internet.",
    requires: "A device that can run it, and your consent.",
    reasons: { live: "Model loaded and answering health checks.", unset: "Not set up yet.", starting: "Loading the model.", error: STOPPED },
  },
  mesh: {
    name: "Mesh link",
    description:
      "Carries sealed messages between nodes with no central server. It joins existing networks from a short preferred list, in order, over Wi-Fi, Bluetooth or long-range radio.",
    requires: null,
    reasons: {
      live: "Running. None of the preferred networks is in range yet.",
      unset: "Not set up yet.",
      starting: STARTING,
      error: "The mesh link stopped answering.",
    },
  },
  radio: {
    name: "Long-range radio",
    description:
      "Long-range radio for the mesh: it lets this node talk to others far away without Wi-Fi or internet. A radio board must be plugged in and set up before it carries traffic.",
    requires: "A radio board on USB.",
    reasons: { live: "Running. The board is listening on the mesh.", unset: "Needs a radio board.", starting: "Starting the radio.", error: "The radio board stopped answering." },
  },
  kb: {
    name: "Knowledge base",
    description: "The offline library of proven recipes, device notes and concepts that ships with the node. The agent reads it to answer you.",
    requires: null,
    reasons: { live: "Knowledge base verified.", unset: "Not set up yet.", starting: "Checking the knowledge base.", error: "The knowledge base failed its check." },
  },
  gateway: {
    name: "Internet gateway",
    description:
      "A role, not a device: any node that reaches the internet says so and becomes a gateway between the offline mesh and the wider world. A laptop flushes its waiting messages whenever it gets online.",
    requires: null,
    reasons: {
      live: "The internet is reachable. This node is a gateway for the mesh while it stays online.",
      unset: "No internet right now. This node becomes a gateway whenever it gets online.",
      starting: "Checking the internet connection.",
      error: "The internet connection has a problem.",
    },
  },
  messaging: {
    name: "Messaging",
    description:
      "Sealed messages between your nodes and your contacts. A message goes straight to the other node when it can be reached, or waits with your home hub until it comes back. Only the two ends can read a message.",
    requires: "A home hub, or another node reachable on this network.",
    reasons: {
      live: "Your home hub is reachable; messages are delivered or held for you.",
      unset: "Not set up yet.",
      starting: STARTING,
      error: "The message store could not be opened.",
    },
  },
  bridge: {
    name: "Bridge",
    description:
      "Joins channels that cannot hear each other, such as long-range radio and Wi-Fi. It stays thin: it carries only the bare minimum across and never reads the payload.",
    requires: "A radio, plus Wi-Fi that can host a hotspot, or ethernet.",
    reasons: {
      live: "Passing sealed traffic between long-range radio and Wi-Fi.",
      unset: "Needs a radio.",
      starting: "Starting the bridge.",
      error: "The bridge stopped passing traffic.",
    },
  },
  storage: {
    name: "Storage",
    description:
      "This node's own encrypted store. Nothing expires on a timer: when space runs short it frees room by capacity alone. Big shared libraries such as maps live on hubs.",
    requires: null,
    reasons: { live: "Encrypted store open. Pruned by capacity only.", unset: "Not set up yet.", starting: "Opening the store.", error: "Store full: new data refused." },
  },
  repairs: {
    name: "Repairs",
    description:
      "The agent watches the health of every layer this device runs. When something breaks it finds the cause, tests a fix in a sandbox and asks you before anything changes.",
    requires: null,
    reasons: {
      live: "Watching every layer this device runs. Nothing to fix right now.",
      unset: "Not set up yet.",
      starting: STARTING,
      error: "The repair loop stopped.",
    },
  },
}

/** The radio service's reason while a board goes through its stages (before it is live). */
export const RADIO_STAGE_REASON: Readonly<Record<RadioStage, string>> = {
  plugged: "A radio board is plugged in. Allow the node to identify it, once.",
  identifying: "Identifying the radio board.",
  identified: "The board has no usable firmware yet. This node can write some from its own signed release.",
  flashing: "Writing firmware to the radio board.",
  flashed: "Firmware is on the board. Pick your region before it transmits.",
  ready: "Starting the radio.",
}

/** The radio's live reason once a region is set. */
export const radioLiveReason = (region: string): string => `Running with the ${region} settings. The board is listening on the mesh.`

/** The board's name as the node detects it (plain words, no product names). */
export const RADIO_BOARD_NAME = "USB radio board"

/** The mesh link's live reason once a preferred network is joined. */
export const meshJoinedReason = (network: string): string => `Running and joined ${network}. Nearby nodes can be heard.`

export const BRIDGE_REASON = {
  needsRadio: SERVICE_COPY.bridge.reasons.unset,
  ready: "Ready to set up: this laptop has a radio and Wi-Fi that can host a hotspot.",
  needsLink: "Needs Wi-Fi that can host a hotspot, or ethernet, beside the radio.",
  /** Plan §6.8, verbatim. */
  buffer: "Nothing is discarded by policy; a full buffer refuses new frames until space frees, and the sender retries.",
} as const

/** The two hand-off buttons of a service page (real `servicePageState`). */
export const HANDOFF = { setup: "Set up with the agent", fix: "Fix with the agent" } as const

// ----------------------------------------------------------------------------------- verdict

/** How each service reads inside a sentence (real `lib/verdict.ts` NOUN). */
export const SERVICE_NOUN: Readonly<Record<ServiceId, string>> = {
  agent: "local AI agent",
  model: "local model",
  mesh: "mesh link",
  radio: "long-range radio",
  kb: "knowledge base",
  gateway: "internet gateway",
  messaging: "message store",
  bridge: "bridge",
  storage: "local store",
  repairs: "repair loop",
}

export const VERDICT_COPY = {
  problem: (things: string, one: boolean): string => `Your node is running, but ${things} ${one ? "has a problem" : "have problems"}.`,
  manyProblems: (n: number): string => `Your node is running, but ${n} things have problems.`,
  meshStarting: "Your node is running. The mesh link is still starting.",
  joined: "Your node is running and connected to nearby nodes: messages can flow.",
  isolated: "Your node is running. It is alone on the mesh right now: no nearby nodes heard.",
  noTransport: "Your node is running. It has no mesh link yet: ask the agent to set one up.",
  internet: " It can reach the internet.",
  device: (n: number): string => (n === 1 ? "a connected device" : `${n} connected devices`),
} as const

/** Overview's nearby summary, from the transport state only (real `nearbySentence`). */
export const NEARBY_SENTENCE = {
  joined: "At least one nearby node has been heard, so messages can flow.",
  isolated: "No nearby nodes heard yet. This node is alone on the mesh right now.",
  "no transport": "This node has no mesh link yet, so it cannot hear anyone. Ask the agent to set one up.",
  "transport degraded": "The mesh link has a problem, so nearby nodes cannot be heard right now.",
} as const

// --------------------------------------------------------------------------------- needs you

export const NEEDS_COPY = {
  title: "needs you",
  nothing: "Nothing needs you right now.",
  proposalDetail: (kind: string): string => `${kind} proposal from the agent`,
  requestsLabel: (n: number): string => (n === 1 ? "1 message request" : `${n} message requests`),
  requestsDetail: "Someone you have not added wrote to you. Nothing is sent back until you accept.",
  kindLabel: { proposal: "proposal", service: "service", device: "device", request: "messages", setup: "not set" },
} as const

/** The header badge tooltip (real `attentionSummary`). */
export const ATTENTION_COPY = {
  none: "Nothing needs you",
  proposals: (n: number): string => (n === 1 ? "1 proposal" : `${n} proposals`),
  serviceErrors: (n: number): string => (n === 1 ? "1 service error" : `${n} service errors`),
  deviceErrors: (n: number): string => (n === 1 ? "1 device error" : `${n} device errors`),
  requests: (n: number): string => (n === 1 ? "1 message request" : `${n} message requests`),
} as const

export const CHECKLIST_COPY = {
  title: "first-run checklist",
  model: "Local model",
  mesh: "Mesh link",
  peer: "First nearby node heard",
  running: "running",
  starting: "starting up",
  peerHeard: "at least one nearby node has been heard",
  peerNeedsMesh: "needs the mesh link first",
  peerNone: "none heard yet",
} as const

// ------------------------------------------------------------------------------------ events

/** The default activity sentence per cause (a slice may pass a more specific one). */
export const EVENT_TEXT: Readonly<Record<KnownCause, string>> = {
  welcome: "A welcome message is waiting in Messages.",
  "radio-plugged": "A radio board was plugged in.",
  "radio-identified": "The radio board was identified. It has no usable firmware yet.",
  "radio-flashed": "Firmware was written to the radio board.",
  "radio-ready": "The radio board is set up and listening.",
  "network-joined": "Joined a preferred network. Heartbeats started.",
  "message-sent": "You sent a message.",
  "custody-ack": "Your home hub took a sealed copy and will hold it.",
  delivered: "Their node acknowledged the message. Only that says delivered.",
  reply: "A reply arrived.",
  "internet-connected": "This node reached the internet and is acting as a gateway.",
  "internet-lost": "The internet connection dropped. This node stays a mesh node.",
  "queue-flushed": "Waiting messages left the outbox through the internet.",
  "listen-burst": "Listened for a minute and noted what was in range.",
  fault: "Something broke on this node.",
  diagnosed: "The agent found the cause.",
  "sandbox-passed": "The fix passed in the sandbox.",
  "sandbox-rejected": "Fix rejected: nothing leaves the sandbox.",
  "fix-applied": "The fix was applied on this node.",
  "fix-shared": "A proven fix was shared through a gateway.",
  "update-check": "Checked for updates.",
  "update-healthy": "The new version passed its trial.",
  "update-rolled-back": "The new version failed its trial, so the node went back to the previous one.",
  "map-fetched": "The regional map arrived from a hub over Wi-Fi.",
  "proposal-added": "The agent wrote a proposal.",
  "proposal-accepted": "You accepted a proposal.",
  "proposal-dismissed": "You dismissed a proposal.",
  "proposal-blocked": "That proposal cannot be carried out yet.",
  "node-heard": "A nearby node was heard.",
  "service-live": "A service is running.",
  "service-error": "A service has a problem.",
}

/** Event sentences that name something. */
export const EVENT_LINE = {
  serviceLive: (name: string): string => `${name} is running.`,
  serviceError: (name: string): string => `${name} has a problem.`,
  networkJoined: (network: string): string => `Joined ${network}. Heartbeats started.`,
  proposalAdded: (title: string): string => `New proposal: ${title}`,
  /** Accept was pressed on a proposal whose service cannot start yet; the proposal stays open. */
  proposalBlocked: (name: string, reason: string): string => `${name} cannot start yet. ${reason}`,
  nodeHeard: (name: string, medium: string): string => `Heard ${name} over ${medium}.`,
} as const

// ----------------------------------------------------------------------------------- devices

/** Attached devices (real lib/devices.ts stateLabel + overview devicesSummary, verbatim where it can be). */
export const DEVICE_COPY = {
  /** Plain kind words of the one attachable device in the demo. */
  radioKind: "long-range radio board",
  state: { connected: "connected", "needs setup": "needs setup", error: "error", disconnected: "disconnected" },
  /** The board's reason once its region is set. */
  radioReady: "Set up and listening on the mesh.",
  /** This laptop's own row: it also bridges, but only under the bootstrap rule (plan §6.8). */
  ownBridges: "also bridges radio and Wi-Fi",
  summary: {
    none: "Nothing attached or paired yet.",
    oneConnected: "1 device, connected.",
    allConnected: (n: number): string => `${n} devices, all connected.`,
    connected: (n: number): string => `${n} connected`,
    needsSetup: (n: number): string => `${n} ${n === 1 ? "needs" : "need"} setup`,
    error: (n: number): string => `${n} ${n === 1 ? "has an error" : "have errors"}`,
    disconnected: (n: number): string => `${n} disconnected`,
    mixed: (n: number, parts: string): string => `${n} ${n === 1 ? "device" : "devices"}: ${parts}.`,
  },
} as const

// ------------------------------------------------------------------------------- layer pages

/** Settings layer pages (real `lib/layers.ts`, verbatim): plain title first, the number second. */
export const LAYER_PAGES = [
  {
    n: 0,
    title: "Knowledge",
    description: "A curated, AI-readable library of proven projects, device profiles and protocols that every other layer reads from.",
  },
  {
    n: 1,
    title: "Install & updates",
    description: "The single entry point: detects this device, decides which layers it can run, installs only what it needs and keeps it current.",
  },
  {
    n: 2,
    title: "Identity",
    description: "Every node gets an automatic, wallet-style cryptographic identity that signs its traffic and needs no account or central authority.",
  },
  {
    n: 3,
    title: "Intelligence",
    description: "A local model acts as the node's agent: your main way to talk to the node and the monitor of its health.",
  },
  {
    n: 4,
    title: "Interface",
    description: "This dashboard: a local, offline-first web app served by the node itself, with chat, status and agent notifications.",
  },
  {
    n: 5,
    title: "Messaging & data",
    description:
      "End-to-end-encrypted, signed messages with store-and-forward delivery across whichever transports are available, and the encrypted store they are kept in.",
  },
  {
    n: 6,
    title: "Transport",
    description: "Joins existing mesh networks as pure transport, tries a preferred list in order and bridges channels that cannot talk to each other.",
  },
  {
    n: 7,
    title: "Relay & presence",
    description: "Nodes announce that they are reachable, and nodes with internet become gateways that sync the offline mesh with the wider network.",
  },
  {
    n: 8,
    title: "Storage",
    description: "An encrypted local store pruned by capacity, plus shared hub datasets such as offline encyclopedias, maps and updates.",
  },
  {
    n: 9,
    title: "Repairs",
    description: "The agent watches every layer, diagnoses failures, tests fixes in a sandbox and prepares a change for a human to approve.",
  },
] as const

/** Header titles per view (real `titleFor`). */
export const ROUTE_TITLES = {
  agent: "Agent",
  overview: "Overview",
  devices: "Devices",
  device: "Device",
  nearby: "Nearby",
  messages: "Messages",
  conversation: "Conversation",
  kb: "Knowledge base",
  service: "Service",
  settings: "Settings",
  notFound: "Not found",
} as const
