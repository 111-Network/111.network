// Copy for the Devices view and device detail (#/devices, #/devices/<id>; layers 1 and 6).
// Mirrors the real views/devices/* and lib/devices.ts wording, in plain words (W1, W5): no board,
// firmware or chip names, no versions, no ids, no ports, no digests, no numbers that read as real
// data. scripts/check-copy.mjs scans every literal here. Exports only DEVICES_-prefixed names.
import { DEVICE_COPY } from "./core"

export const DEVICES_COPY = {
  // ----------------------------------------------------------------------- the list (real list.tsx)
  list: {
    kicker: "devices",
    title: "Devices",
    intro:
      "The agent looks at everything connected or paired, works out what each thing is, and gives you the steps or a proposal for what is missing.",
    connect: "Connect with the agent",
    connectFrom: "Devices",
    /** Real lib/prompts.ts goal "connect", for the whole registry. */
    connectPrompt:
      "Look at everything connected or paired: identify what each thing is, set up what is needed, and fix any errors so it works on the mesh.",
    add: "Add device",
    emptyTitle: "Nothing connected yet.",
    emptyBody: "Plug in a long-range radio board, or pair a phone from Add device.",
    /** Real KIND_TITLE.radio, in plain words. */
    group: "Long-range radio boards",
    columns: { device: "Device", kind: "Kind", driver: "Driven by", seen: "Last seen" },
    /** A board that is plugged in right now. */
    seenNow: "just now",
    /** The board's prompt panel under the list, right after "[DEMO] plug in a radio board". */
    promptPanel: "new board",
    /** Below a 640 px container the three side columns fold into a line of the name cell. */
    folded: (kind: string, driven: string, seen: string): string => `${kind} · driven by ${driven} · seen ${seen}`,
  },

  // ------------------------------------------------------------------ this laptop (the node itself)
  own: {
    panel: "this node",
    suffix: "device",
    badge: "this node",
    caption: "The device this dashboard runs on. It is the node itself, not something attached to it.",
    rows: { device: "Device", label: "Label", has: "Has", bridge: "Bridge" },
    /** The bootstrap rule (plan §6.8), said only when the facts show it. */
    bridges: (why: string): string => `${DEVICE_COPY.ownBridges}: ${why}.`,
    whyHotspot: "it has a radio board and Wi-Fi that can host a hotspot",
    whyEthernet: "it has a radio board and an ethernet port",
    notYetSetup: "Not yet: the radio board has to be set up first.",
    notYetNoRadio: "Not yet: a bridge needs a radio board beside Wi-Fi that can host a hotspot, or ethernet.",
    noLink: "No: it has no Wi-Fi that can host a hotspot and no ethernet port.",
    openBridge: "Open Bridge",
    nameHint: "Change it under",
    ask: "Ask the agent what this device can run",
    /** The Agent's starter question, verbatim, so the canned reply answers it. */
    askPrompt: "What can this device run?",
    from: "Devices",
  },

  // --------------------------------------------------------------- one board (real detail.tsx)
  detail: {
    kicker: "device",
    back: "All devices",
    notFound: {
      kicker: "404",
      title: "No such device",
      body: "This node has no device with that id. It may have been forgotten, or it is not plugged in any more.",
      action: "Back to Devices",
    },
    likely: "likely",
    /** Real NEEDS_FIRMWARE tag. */
    needsFirmware: "NEEDS FIRMWARE",
    presence: (duration: string): string => `for ${duration}`,
    fewSeconds: "a few seconds",
    agentLabel: { setup: "Let the agent handle it", check: "Ask the agent about this device" },
    agentNote: "The agent gives you steps or a proposal. It does not touch the hardware itself.",
    /** Real lib/prompts.ts goal "setup" and the device question, verbatim in shape. */
    setupPrompt: (name: string): string => `Set up the ${name} on this node and test it.`,
    fixPrompt: (name: string): string => `Fix the ${name} on this node.`,
    checkPrompt: (name: string): string => `About the device ${name}: what is it, is it working, what can it do?`,
    specTitle: "This device",
    rows: {
      detected: "Detected name",
      identifiedAs: "Identified as",
      confidence: "Confidence",
      firmware: "Firmware",
      driven: "Driven by",
      service: "Service",
      transport: "Transport",
      region: "Region",
      kb: "Knowledge base",
      firstSeen: "First seen",
      consent: "Identify consent",
    },
    kbOpen: "Open the entry",
    transport: "USB",
    identifiedAs: "a long-range radio board",
    confidence: {
      likely: "likely: how it plugged in names the chip, not the board",
      identified: "identified: it answered when the node asked, once",
    },
    firmware: {
      unknown: "not known yet: identifying needs your consent",
      checking: "being checked",
      none: "none this node can use",
      writing: "being written",
      mesh: "mesh firmware from this node's own release",
    },
    driven: { none: "nothing yet", radio: "Long-range radio" },
    regionUnset: "not set: it stays silent until you pick one",
    consentGiven: (clock: string): string => `given once, at ${clock}`,
    consentNone: "not given",
    firstSeen: (clock: string, ago: string): string => `${clock} (${ago})`,
    unplug: "unplug the radio board",
    unplugged: "The radio board was unplugged.",
    unplugConfirm: (name: string): string => `Unplug ${name}? The radio stops, and the nodes it heard leave Nearby. Go ahead`,
  },

  // ------------------------------------------------------------------- rename (real RenameForm)
  rename: {
    label: "Name",
    save: "Save name",
    help: (detected: string): string => `Leave it empty to use the detected name: ${detected}`,
    done: "Renamed.",
  },

  // ---------------------------------------------- identify, once, with consent (Layer 6 identify)
  consent: {
    panel: "identify",
    suffix: "consent",
    question: "Allow once?",
    body: (name: string): string =>
      `Let the node identify ${name}, once. It talks to the board one time to learn what it is. That can restart the board; nothing is written to it.`,
    allow: "Allow once",
    notNow: "Not now",
    declinedTitle: "Not identified.",
    declinedBody: "The board stays as it is. Nothing talks to it until you allow it.",
    askAgain: "Identify it…",
    openPage: "Open the board's page",
    offerLink: "See the firmware offer",
    identifyingTitle: "Identifying the board…",
    identifyingBody: "The node is asking the board what it is. This happens once.",
    identifiedTitle: "Identified: a long-range radio board.",
    identifiedBody: "It has no usable firmware yet. The board's page offers some, and you decide.",
  },

  // ------------------------------------------------------ the firmware offer (real flash.tsx)
  flash: {
    panel: "firmware",
    suffix: "offer",
    noFirmware: "This board has no usable firmware.",
    board: (name: string): string => `${name} · long-range radio board · USB.`,
    why: "It answered as a long-range radio board, but what is on it is not firmware this node can use.",
    tableTitle: "What would be written",
    rows: { firmware: "Firmware", builtFor: "Built for", source: "Comes from" },
    firmware: "mesh firmware for long-range radio",
    builtFor: "this kind of board",
    /** Real FLASH_SOURCE, verbatim. */
    source: "Inside this node's signed release. Nothing is downloaded.",
    erasesTag: "Erases",
    /** Real erasesSentence fallback, verbatim. */
    erases: "Flashing erases everything that is on the board now.",
    open: "Flash firmware…",
    askInstead: "Ask the agent instead",
    openNote: "Nothing is written until you confirm on the next step.",
    confirmLabel: "Confirm flashing",
    before: "Before you flash",
    checks: {
      erase: "I understand everything on the board will be erased",
      own: "This board is mine or I am allowed to flash it",
    },
    typeLabel: "Type the device's name to confirm",
    typeHelp: "Type it exactly as shown, capitals included:",
    now: "Flash now",
    cancel: "Cancel",
    /** Real missingText parts: "Still needed: tick both boxes and type the name exactly as shown." */
    missing: {
      lead: "Still needed:",
      both: "tick both boxes",
      first: "tick the first box",
      second: "tick the second box",
      name: "type the name exactly as shown",
      and: "and",
    },
    startedTitle: "Flashing started: mesh firmware for this board.",
    startedBody: "Keep the board plugged in. This page updates when the board reports its new firmware.",
    doneTitle: "Flashed: mesh firmware for this board.",
    doneBody: "The board now reports the node's mesh firmware. It does not transmit until you pick your region.",
  },

  // ------------------------------------------------------------------ the region, before it transmits
  region: {
    panel: "region",
    suffix: "setup",
    legend: "Pick your region",
    body: "Radio rules differ from region to region. The board stays silent until you pick the one you are in.",
    set: "Set region",
    missing: "Pick a region first.",
  },

  // ------------------------------------------------------------------------- set up and listening
  ready: {
    suffix: "ready",
    region: (region: string): string => `Region: ${region}.`,
    nearby: "See what it hears",
    nearbyNote: "Nodes it hears show up under Nearby, each with the reason it was heard.",
    title: "The board is set up.",
  },

  // ------------------------------------------------------------------------ Add device (real add.tsx)
  add: {
    kicker: "devices",
    title: "Add device",
    intro: "Pick what you want to connect. Hardware shows up in the list by itself once the node can see it.",
    guide: "Guide me with the agent",
    radio: {
      title: "Long-range radio board over USB",
      body: "Plug it in. It appears in the list by itself within a few seconds. The board shows as ‘likely’ until it is identified.",
      prompt: "Set up my radio: I am plugging a long-range radio board in over USB.",
      from: "Add device: radio board",
      plugged: "A radio board is plugged in.",
      open: "See it in the list",
    },
    bluetooth: {
      title: "Bluetooth device",
      body: "Adapters already show in the list. The agent walks you through pairing anything else.",
      prompt: "I want to connect a Bluetooth device. Walk me through it.",
      from: "Add device: Bluetooth",
    },
    phone: {
      title: "Phone or laptop",
      control: {
        title: "Control this node",
        body: "On the phone or laptop, join the same network and open this node's dashboard. It then shows here under your phones and laptops.",
      },
      node: {
        title: "Make it a node of its own",
        body: "Run the install command on a computer with the phone connected over USB-C. Ask the agent for the exact command.",
        ask: "Ask the agent how",
        prompt: "I want to make an old phone a node of its own, installed over USB-C. How?",
        from: "Add device: phone as a node",
      },
      through: {
        title: "Message through this node",
        body: "A phone with no radio of its own can send and receive mesh messages through this node's radio, over Wi-Fi or Bluetooth.",
      },
    },
    handheld: {
      title: "Handheld radio",
      body: "Licensed operators only. Amateur bands allow plain text only, so sealed mesh traffic cannot go over them. The node detects one and explains what it can and cannot do.",
    },
  },

  // ------------------------------------------- the hand-off while the agent is down (real AgentButton)
  agent: {
    show: "Show the request",
    hide: "Hide the request",
    copy: "copy the request",
    copyAria: "Copy the request",
    down: "The local agent is not running right now. This is the request it would get.",
    recipeNote: "The recipe has the steps.",
    tail: "Copy it for when the agent is back.",
    recipe: "Read the recipe",
  },
} as const
