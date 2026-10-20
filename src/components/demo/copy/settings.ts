// Copy for the Settings: Essentials and the layer pages (#/settings, #/settings/l0 .. l9).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed SETTINGS_
// (or grow the one SETTINGS_COPY object) so the copy/index.ts barrel never collides.
//
// Mirrors os/4-interface/ui/src/views/settings/{essentials,layer-page,model}.ts, minus everything
// that only exists because of the real API: no CLI strings, no hostnames, no addresses, no word
// count for the backup, no pair codes (plan §6.8), and no "coming" marks (W4).
import type { LayerNumber } from "../engine/types"

/** The two-step confirm of Restart names the node; an alias can be long, the question stays readable. */
export const SETTINGS_NAME_MAX = 40

export const SETTINGS_COPY = {
  essentials: {
    kicker: "essentials",
    title: "Settings",
    panel: "essentials",
  },

  /** The five Essentials rows, in their fixed order (real model.ts ESSENTIALS). */
  rows: {
    alias: {
      label: "Node name",
      help: "A friendly name for this node, shown in the sidebar and the agent prompts. Leave it empty to use the name it came with. It does not change the node's identity.",
    },
    mode: {
      label: "View mode",
      help: "Simple shows what you need day to day. Advanced adds the layer pages and raw detail. This only changes what this dashboard shows.",
    },
    backup: {
      label: "Identity backup",
      help: "Your identity works with no backup. Back up any time from the node itself.",
      note: "The dashboard never shows or sends your keys.",
    },
    restart: {
      label: "Restart node",
      help: "Restarts the node's software. This page disconnects for a moment and reconnects on its own.",
    },
    updates: {
      label: "Check for updates",
      help: "Asks the node to look for a newer version now. The result updates below as it arrives.",
    },
  },

  alias: {
    save: "Save",
    saved: "Saved.",
  },

  restart: {
    button: "Restart node",
    confirm: (name: string): string => `Restart ${name}`,
    restarting: "restarting — this page will reconnect",
    back: "The node restarted and this page reconnected.",
    waitForUpdate: "An update is running. Restart once it has finished.",
  },

  /** Real SharingPanel, without the pair code and the loopback-only gate (this page runs on the node itself). */
  sharing: {
    panel: "sharing",
    lan: {
      label: "Share on this network",
      help: "Lets other devices on this Wi-Fi open this dashboard. Traffic is not encrypted on shared Wi-Fi. Takes effect after a restart.",
      toggle: "Share on this network",
      on: "[ON]",
      off: "[OFF]",
      state: (on: boolean): string => `Sharing ${on ? "on" : "off"}.`,
      pending: (on: boolean): string => `Sharing ${on ? "on" : "off"}. Restart the node to apply.`,
    },
    offer: {
      label: "Standard tier (local model)",
      help: "A small AI model that runs on this node, so the agent can answer without the internet. Accepting records your choice on the node.",
      state: "state: ",
      accepted: "accepted",
    },
  },

  /** Install & updates (L1) and the Essentials update row. A version is named in words, never a number. */
  update: {
    panel: "updates",
    heading: "Updates",
    help: "A new version first runs on trial while the node checks its own health. If anything fails, the node goes back to the version before, by itself.",
    fail: "fail the next trial",
    failHelp: "A demo switch: the next trial fails a health check, so you can watch the node go back.",
    failNone: "This node already runs the newer version, so there is no trial left to fail.",
    started: "Check started. The result appears below.",
    more: "Every step on Install & updates",
    busyRestart: "The node is restarting. Check again once it is back.",
    rows: {
      state: "State",
      running: "Running",
      lastCheck: "Last check",
      lastResult: "Last result",
      source: "Comes from",
    },
    phase: {
      idle: "idle",
      checking: "checking",
      staged: "downloaded, signature checked",
      probation: "on trial",
      reverting: "going back to the previous version",
    },
    running: {
      installed: "the version installed at setup",
      newer: "the newer version",
    },
    result: {
      "up to date": "up to date",
      updated: "updated: the new version passed its trial",
      "rolled back": "rolled back: the new version failed its trial",
    },
    never: "never",
    noResult: "none yet",
    source: {
      hub: "your home hub, over Wi-Fi",
      internet: "the internet",
    },
    when: (day: string, clock: string): string => `${day}, ${clock}`,
    stepsLabel: "Steps of the last update check",
    steps: {
      check: "check",
      verify: "download and verify",
      trial: "trial",
      result: "result",
    },
    stepState: {
      done: "done",
      current: "now",
      pending: "waiting",
      skipped: "not needed",
      failed: "failed",
    },
    resultWord: {
      healthy: "healthy",
      rolledBack: "rolled back",
      upToDate: "up to date",
      reverting: "going back",
    },
    /** The sentence beside the stepper. */
    status: {
      idle: "No check running.",
      checking: "Checking for a newer signed version.",
      staged: (source: string): string => `A newer signed version came from ${source}. Its signature checks out.`,
      probation: "The new version is running on trial. The previous one is kept until the trial ends.",
      reverting: "The new version failed a health check during its trial. Going back to the previous one.",
      "up to date": "This node is up to date.",
      updated: "The new version passed its trial and is now the running one.",
      "rolled back": "Back on the previous version. Nothing else changed.",
    },
    logTitle: "updates",
    logEmpty: "No check in this session yet.",
    log: {
      checking: "checking for a newer signed version",
      found: (source: string): string => `newer version found on ${source}; signature checked`,
      none: "no newer version: up to date",
      trial: "new version running on trial; previous version kept",
      passed: "trial passed: the new version is now running",
      failed: "a health check failed during the trial",
      reverting: "going back to the previous version",
      rolledBack: "back on the previous version",
    },
  },

  /** Store events (announced by the shell, listed in activity). */
  events: {
    found: "Checked for updates: a newer signed version is ready. It runs on trial first.",
    upToDate: "Checked for updates: this node is up to date.",
    trial: "The new version is running on trial. The previous one is kept.",
    restart: (name: string): string => `Restarting ${name}. This page will reconnect.`,
    restarted: "The node restarted and this page reconnected.",
  },

  /** Layer pages (real layer-page.tsx), with the intended surfaces of every layer (os/README.md). */
  layer: {
    kicker: (n: LayerNumber): string => `Layer ${n}`,
    about: "about",
    aboutHeading: "What it is",
    statusHeading: "Status this layer owns today",
    status: "status",
    here: "here",
    hereHeading: "How it works on this node",
    whereHeading: "On this dashboard",
    agent: "agent",
    askHeading: "Ask the agent",
    askNote: "Opens the Agent with a prepared question about this layer. You can edit it first, and nothing is sent until you send it.",
    ask: (title: string): string => `Ask the agent about ${title}`,
    prompt: (n: LayerNumber, title: string): string => `About Layer ${n} (${title}): what is its state on this node and what should I configure?`,
  },

  /** What each layer does, in two or three plain sentences (os/README.md, plan §5). */
  points: {
    0: [
      "The offline library every other layer reads from: proven projects, device notes, recipes and concepts.",
      "Every note carries a grade: candidate, testing or proven.",
      "It ships with the node, and the agent reads it before it answers or proposes anything.",
    ],
    1: [
      "One command or one tap turns a fresh or already used device into a node.",
      "It reads the hardware, works out which layers fit and installs only those. Nothing to configure, and running it again is safe.",
      "Updates arrive signed and run on trial first; a failed trial goes back by itself.",
    ],
    2: [
      "Made on this node at setup: no sign-up, no phone number, no email, no authority to ask.",
      "Others know the node by its public half; the private half never leaves it.",
      "Known keys are pinned: a node that knows yours never accepts a different key for it.",
    ],
    3: [
      "The agent runs on this laptop with its own local model, so chat works without the internet.",
      "Lighter devices borrow a nearby hub's agent over the local network.",
      "It reads the knowledge base and the node's health, and writes proposals. You decide.",
    ],
    4: [
      "Served by the node itself, it works offline in any browser on this laptop.",
      "Chat, node and mesh status and the agent's notifications live here.",
      "Simple shows what you need day to day; Advanced adds the layer pages and raw detail.",
    ],
    5: [
      "Only the two ends can read a message, and every message is signed by the node that wrote it.",
      "A message goes straight to the other node when it can, or waits with your home hub until it comes back.",
      "Four states: queued, sent, relayed, delivered. Only the other node's acknowledgement says delivered.",
    ],
    6: [
      "A short list of preferred networks is tried in order; the first one found starts heartbeats.",
      "A bridge joins channels that cannot hear each other, such as long-range radio and Wi-Fi, and stays thin.",
      "This laptop bridges only with a radio board plus Wi-Fi that can host a hotspot, or ethernet.",
    ],
    7: [
      "Nodes announce that they are reachable with heartbeats.",
      "A node that reaches the internet becomes a gateway while it stays online, and flushes its waiting messages.",
      "Offline again, it stays a plain mesh node. Being a gateway never changes what the device is.",
    ],
    8: [
      "This node's store is encrypted and freed by capacity alone: nothing expires on a timer.",
      "Hubs keep the big shared libraries: offline encyclopedias, regional maps, updates and repair patches.",
      "Big datasets come from a hub over Wi-Fi; they are not practical over long-range radio.",
    ],
    9: [
      "The agent watches every layer this device runs, finds the cause of a failure and tests a fix in a sandbox.",
      "You approve before anything changes here, and the change goes upstream for the maintainers.",
      "A proven fix reaches other nodes through gateways; each one re-checks it in its own sandbox, and its owner approves.",
    ],
  },

  /** "On this dashboard" links per layer (the targets live in views/settings/model.ts). */
  where: {
    agent: { label: "Agent", note: "chat with the node" },
    overview: { label: "Overview", note: "the node at a glance" },
    devices: { label: "Devices", note: "what is attached to this laptop" },
    nearby: { label: "Nearby", note: "nodes heard around this one" },
    messages: { label: "Messages", note: "conversations and requests" },
    kb: { label: "Knowledge base", note: "the notes, by drawer" },
    essentials: { label: "Essentials", note: "name, view mode, restart, updates" },
    identity: { label: "Identity · L2", note: "this node's public card" },
    install: { label: "Install & updates · L1", note: "updates and their trial" },
    /** The note beside a service link (the label is the service's own name). */
    serviceNote: "service page",
  },

  /** Status rows of the layer pages: labels, then values in words. */
  status: {
    reason: "Reason",
    works: "Works offline",
    yes: "yes",
    no: "no",
    device: "Device",
    update: "Update",
    running: "Running",
    lastCheck: "Last check",
    lastResult: "Last result",
    nodeLabel: "Node label",
    nodeName: "Node name",
    identity: "Identity",
    identityValue: "made on this node at setup",
    backup: "Backup",
    backupValue: "optional · works without one",
    keys: "Known keys",
    keysValue: "pinned, never swapped",
    whereRuns: "Runs",
    whereRunsValue: "on this node",
    servedBy: "Served by",
    servedByValue: "this node",
    openOn: "Open on",
    openOnLocal: "this laptop",
    openOnShared: "this laptop and devices on its Wi-Fi",
    sharing: "Shared on this network",
    sharingPending: (on: boolean): string => `${on ? "on" : "off"} after a restart`,
    on: "on",
    off: "off",
    mode: "View mode",
    homeHub: "Home hub",
    homeHubValue: (name: string): string => `${name}, over Wi-Fi`,
    store: "Message store",
    storeValue: "encrypted on this node",
    transport: "Transport",
    transportValue: {
      joined: (network: string): string => `joined ${network}`,
      isolated: "alone on the mesh: no preferred network in range",
      "no transport": "no mesh link",
      "transport degraded": "the mesh link has a problem",
    },
    networks: "Preferred networks",
    networkLine: (name: string, medium: string, state: string): string => `${name} · ${medium} · ${state}`,
    heartbeats: "Heartbeats",
    heartbeatsOn: "running",
    heartbeatsOff: "waiting for a preferred network",
    heard: "Nearby nodes heard",
    heardNone: "none yet",
    libraries: "Big shared libraries",
    librariesValue: "on hubs, fetched over Wi-Fi",
    proposals: "Open proposals",
    gate: "Human gate",
    gateValue: "you approve every change",
  },

  /** Identity (L2): the public card plate, the alias editor and the backup note. */
  identity: {
    panel: "identity",
    cardSuffix: "card",
    cardHeading: "Public card",
    cardKicker: "node card",
    name: "name",
    label: "label",
    labelNote: "For people to read aloud. It is not proof of who the node is.",
    copyLabel: "Copy node label",
    device: "device",
    publicHalf: "public half",
    publicNote: "shared with peers",
    publicImage: "public half: this node's own key, drawn",
    privateHalf: "private half",
    staysHere: "stays here",
    issuedBy: "issued by",
    nobody: "nobody",
    notNeededFields: ["phone", "email", "registry"],
    notNeeded: "not needed",
    backup: "backup",
    backupValue: "optional · works without one",
    pinned: "pinned",
    pinnedNote: "Known keys are pinned: a node that knows this card never accepts a different key for it.",
    aliasPanel: "name",
    aliasHeading: "Node name",
    backupPanel: "backup",
    backupHeading: "Backup",
    backupText: "Your identity works with no backup, and nothing on this node waits for one. Back up any time from the node itself.",
  },

  /** Install & updates (L1): this device. */
  device: {
    panel: "this device",
    heading: "This device",
    rows: {
      device: "Device",
      has: "Has",
      setup: "Setup",
      telemetry: "Telemetry",
    },
    setupValue: "none needed: it read the hardware and installed only what fits",
    telemetryValue: "none",
  },

  /** Messaging & data (L5): the home hub. */
  hub: {
    panel: "home hub",
    heading: "Home hub",
    rows: {
      hub: "Home hub",
      device: "Device",
      label: "Label",
      reach: "Reached over",
      role: "What it does",
    },
    open: "Open Messages",
  },
} as const
