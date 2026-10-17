// Copy for the Bridge service view (#/services/bridge, Layer 6). Owned by the bridge view task.
// Every user-visible sentence of the view lives here, in plain words (W1, W5; scripts/check-copy.mjs
// scans these literals). Shared words (BRIDGE_REASON incl. the buffer sentence, NETWORK_COPY,
// RADIO_STAGE_REASON, DEMO_ACTIONS) stay in copy/core.ts and are imported from there.
//
// The bridge is not built in reality: this is the intended surface from os/README.md Layer 6
// ("Bridges join physically incompatible channels … remain thin: they translate only the minimal
// common format and never reimplement the underlying radio or routing") and plan §6.4 / §6.8.

/** Which side of the bridge a band is. */
type Side = "radio" | "wifi"

const SIDE_WORD: Readonly<Record<Side, string>> = { radio: "long-range radio", wifi: "Wi-Fi" }

export const BRIDGE_COPY = {
  /** The bridge's reason while it waits for a radio that stopped (it turns back on by itself). */
  pausedReason: "Paused: the long-range radio is not running. The bridge turns back on when it is.",

  // ------------------------------------------------------------------------- the role toggle
  role: {
    label: "Bridge radio and Wi-Fi",
    on: "ON",
    off: "OFF",
    starting: "STARTING",
    offNote: "Turn it on here, or ask the agent to set it up. It only passes traffic while it is on.",
    pausedNote: "Paused while the long-range radio is not running.",
  },

  // -------------------------------------------------------------- this laptop (bootstrap rule)
  facts: {
    title: "this laptop",
    suffix: "can it bridge?",
    heading: "Can this laptop bridge?",
    rule: "A bridge needs a running radio, plus either Wi-Fi that can host a hotspot or an ethernet port.",
    radio: "Radio board",
    hotspot: "Wi-Fi that can host a hotspot",
    ethernet: "Ethernet port",
    outcome: "Can bridge here",
    yes: "yes",
    no: "no",
    radioNone: "none plugged in yet",
    radioSetup: "plugged in, being set up",
    radioRunning: "running",
    radioProblem: "has a problem",
    ready: "yes: a radio plus Wi-Fi that can host a hotspot",
    readyEthernet: "yes: a radio plus an ethernet port",
    needsRadio: "not yet: it needs the radio first",
    needsLink: "no: it needs a hotspot or an ethernet port beside the radio",
    radioLink: "Open the long-range radio page",
  },

  // ------------------------------------------------------------------------- radio board steps
  radio: {
    title: "radio board",
    suffix: "setup",
    heading: "Set up the radio board",
    none: "No radio board is plugged in. The bridge needs one for its long-range radio side.",
    boardPage: "Open the board's page",
    stepsLabel: "Radio board steps",
    steps: ["allow once", "identify", "write firmware", "pick a region"],
    stepDone: "done",
    stepNow: "now",
    stepNext: "next",
    titles: {
      plugged: "Allow the node to identify the board, once?",
      identifying: "Identifying the board",
      identified: "This board has no usable firmware.",
      flashing: "Writing firmware",
      flashed: "Pick your region",
      starting: "Starting the radio",
    },
    allow: "Allow once",
    allowNote: "The node only listens to the board for a moment. Nothing is written to it.",
    detected: "Detected",
    detectedValue: "a long-range radio board, on USB",
    source: "Source",
    sourceValue: "Inside this node's signed release. Nothing is downloaded.",
    erases: "Flashing erases everything that is on the board now.",
    flashOpen: "Flash firmware…",
    flashOpenNote: "Nothing is written until you confirm on the next step.",
    confirmLabel: "Confirm flashing",
    before: "Before you flash",
    checks: {
      erase: "I understand everything on the board will be erased",
      own: "This board is mine or I am allowed to flash it",
    },
    typeName: "Type the device's name to confirm",
    typeHelp: "Type it exactly as shown, capitals included:",
    flashNow: "Flash now",
    cancel: "Cancel",
    missing: {
      prefix: "Still needed:",
      both: "tick both boxes",
      first: "tick the first box",
      second: "tick the second box",
      name: "type the name exactly as shown",
    },
    region: "Region",
    regionPlaceholder: "Pick a region",
    regionSet: "Set region",
    regionNote: "The board does not transmit until a region is set.",
    regionMissing: "Pick a region first.",
    /** The line under a step that waits on the node, not on you. */
    busy: {
      identifying: "The node listens to the board for a moment. Nothing is written to it.",
      flashing: "Keep the board plugged in. This page updates when the board reports its new firmware.",
      starting: "The radio starts with your region's settings, then the node tries its preferred networks in order.",
    },
    working: "working",
  },

  // ------------------------------------------------------------- the radio stopped (set-up board)
  down: {
    title: "long-range radio",
    suffix: "not running",
    heading: "The long-range radio is not running",
    body: "The bridge needs the radio running to pass anything across. The radio's page says why it stopped and how to bring it back.",
  },

  // ------------------------------------------------------------------- preferred networks (L6)
  networks: {
    title: "preferred networks",
    suffix: "tried in order",
    heading: "Preferred networks, tried in order",
    listLabel: "Preferred networks in the order they are tried",
    priority: "Priority",
    priorityValue: "1 > 2 > 3 · first hit wins",
    result: "Result",
    joined: (network: string): string => `JOINED ${network}`,
    seeking: "seeking…",
    none: "NONE IN RANGE → messages wait on the device",
    tries: { found: "FOUND", trying: "trying", "no signal": "no signal", "not tried": "not tried" },
    heartbeats: (network: string, at: string | null): string =>
      at ? `Heartbeats started at ${at} on ${network}.` : `Heartbeats started on ${network}.`,
    note: "The list is short, ordered and curated in the knowledge base. The node never builds a network of its own: it rides these as plain transport, and falls back down the list when one is not in range.",
    read: "Read about preferred networks",
  },

  // ---------------------------------------------------------------------------- the diagram
  diagram: {
    title: "bridge",
    suffix: "diagram",
    heading: "How the bridge passes a message",
    bandsLabel: "The two networks and the bridge between them",
    bands: {
      radio: { title: "long-range radio", joined: (n: string): string => `${n} · joined`, notJoined: (n: string): string => `${n} · not joined` },
      bridge: { title: "bridge", sub: "this laptop · carries the bare minimum across", on: "on", off: "off" },
      wifi: { title: "Wi-Fi", sub: "this laptop's hotspot · phones and laptops nearby" },
    },
    detail: {
      radio:
        "Long-range radio reaches nodes far away, slowly, in small frames. That network does its own radio work and its own routing; the bridge leaves both alone.",
      wifi: "The hotspot this laptop hosts. Phones and laptops nearby join it: fast, and short range.",
      does: "Does",
      doesValue: "carry the bare minimum across, buffer briefly",
      doesNot: "Does not",
      doesNotValue: "reinvent the radio, reinvent routing, read the payload",
      translates: "Translates",
      translatesValue: "only the minimal common format",
      buffer: "When the buffer is full",
    },
    direction: "Direction",
    directions: { "radio-to-wifi": "radio → Wi-Fi", "wifi-to-radio": "Wi-Fi → radio" },
    cross: "pass a sealed message across",
    needsOn: "Turn the bridge on to pass a message across.",
    idle: "Pick a band to read what it does. The demo button passes one sealed sample message across.",
    wrapper: (side: Side): string => `outer wrapper: ${SIDE_WORD[side]}`,
    wrapperSwap: (from: Side, to: Side): string => `outer wrapper: ${SIDE_WORD[from]} → ${SIDE_WORD[to]}`,
    payload: "sealed payload",
    unchanged: "unchanged",
    caption: {
      in: (from: Side): string => `A sealed message arrives over ${SIDE_WORD[from]}, inside a ${SIDE_WORD[from]} wrapper.`,
      swap: (from: Side, to: Side): string =>
        `At the bridge only the outer wrapper changes: the ${SIDE_WORD[from]} wrapper comes off and a ${SIDE_WORD[to]} wrapper goes on. The payload stays sealed.`,
      out: (to: Side): string => `It leaves over ${SIDE_WORD[to]} with the same sealed payload. The bridge never read it.`,
    },
    thinSummary: "Why the bridge stays thin",
    thinBody:
      "A bridge translates only the minimal common format between the two sides. The radio network keeps doing its own radio work and routing, and so does the Wi-Fi side. The bridge reimplements neither, so it has little to break and nothing to read.",
  },

  /** The activity line once a sample message has crossed (event "bridge/crossed"). */
  crossedEvent: (from: Side, to: Side): string =>
    `A sealed message crossed the bridge from ${SIDE_WORD[from]} to ${SIDE_WORD[to]}. Only its outer wrapper changed.`,
} as const
