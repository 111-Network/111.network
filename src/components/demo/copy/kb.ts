// Copy for the Knowledge base view (#/kb, #/kb/<drawer>, #/kb/<drawer>/<note>; Layer 0).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed KB_ so the
// copy/index.ts barrel never collides.
//
// The cards themselves come from the home L0 section (src/components/sections/layer-0/catalog.ts),
// so both pages show the same library with the same grades. KB_EXTRA_NOTES adds the notes the
// demo's service pages point at (DEMO_WORLD.services[].kb) that L0 does not carry. Every one is a
// role or an idea, never a product, and is grounded in os/README.md:
//   local-agent ← Layer 3 · preferred-networks ← Layer 6 · set-up-a-radio-board ← the Devices flow
//   gateway-role ← Layer 7 + the gateway overlay role · store-and-forward ← Layer 5 + Messaging
//   thin-bridge ← Layer 6 bridges · capacity-pruning ← Layer 8 · sandbox-first ← Layer 9 + W13
// Concepts carry no grade; the one recipe is "testing". No "proven" tally appears anywhere (§6.8).
import type { CatalogCard, DrawerId } from "@/components/sections/layer-0/catalog"
import { HEAL_RAIL_LINE } from "@/lib/heal"
import { BRIDGE_REASON } from "./core"

/** A demo-only note: an L0 card plus an optional "Details" list (the real entries' Details section). */
interface NoteText extends CatalogCard {
  details?: readonly string[]
}

/** Title and one-line blurb of each drawer, by the L0 drawer id (labels come from L0). */
export const KB_DRAWER_COPY: Readonly<Record<DrawerId, { title: string; blurb: string }>> = {
  projects: {
    title: "Projects",
    blurb: "Existing projects the node can adopt, one note each, graded by the evidence behind them.",
  },
  devices: {
    title: "Devices",
    blurb: "What each kind of device can run, its known quirks, and how it joins the network.",
  },
  recipes: {
    title: "Recipes",
    blurb: "Written steps that set one piece up on one device. The installer reads them.",
  },
  protocols: {
    title: "Protocols",
    blurb: "The protocols and formats the network speaks, or could learn to speak.",
  },
  models: {
    title: "Local models",
    blurb: "The models and engines the agent can think with, offline.",
  },
  concepts: {
    title: "Concepts",
    blurb: "Timeless ideas the other notes rest on. A concept carries no grade.",
  },
}

export const KB_COPY = {
  kicker: "knowledge base",
  drawerKicker: "knowledge base · drawer",
  noteKicker: "knowledge base · note",
  lead: "The offline library every layer reads from: small notes, one topic each, graded by the evidence behind them. The agent reads it first, the installer takes its recipes from it, and it settles one question again and again: if a solid project already exists, use it.",

  crumbs: {
    label: "Breadcrumb",
    all: "All drawers",
  },

  reader: {
    group: "Reader",
    human: "HUMAN",
    agent: "AGENT",
    announce: {
      human: "Human view: the full note.",
      agent: "Agent view: one index line per note.",
    },
    note: "The agent reads one line per note and opens the full note only when it must.",
  },

  drawers: {
    nav: "Drawers",
    /** Read after the label plate, so a screen reader hears "PROJECTS drawer". */
    suffix: " drawer",
    count: (n: number): string => (n === 1 ? "1 note" : `${n} notes`),
    matches: (n: number): string => (n === 0 ? "no match" : n === 1 ? "1 match" : `${n} matches`),
  },

  find: {
    label: "Find a note",
    placeholder: "radio, phone, hub …",
    hint: "Matches titles, summaries, tags and paths. Every word must match.",
    clear: "Clear",
    all: (n: number): string => `${n} notes in six drawers.`,
    inDrawer: (n: number, drawer: string): string => `${n === 1 ? "1 note" : `${n} notes`} in the ${drawer} drawer.`,
    results: (n: number): string => (n === 1 ? "1 note matches." : `${n} notes match.`),
    none: (q: string): string => `No note matches "${q}".`,
    noneHere: (q: string, drawer: string): string => `No note in the ${drawer} drawer matches "${q}".`,
    noneHint: "Try a shorter word, such as radio, phone or hub.",
    elsewhere: "Other drawers hold matches: their fronts above show how many.",
  },

  /** The agent's retrieval ritual (L0 call slip), printed whole under the find field in the agent view. */
  slip: {
    title: "Call slip",
    reader: "reader: agent",
    steps: (q: string): readonly string[] => ["READ INDEX", `SEARCH "${q}"`, "OPEN ONE", "STOP"],
    stepsLabel: "Call slip steps",
    opens: "opens:",
    only: "· nothing else read",
    nothing: "no note matched: nothing opened",
  },

  index: {
    title: "index",
    suffix: "agent",
    region: "The agent's index",
    heading: "# Knowledge base",
    about: "> The offline library every layer reads from.",
    grammar: "> Each line: - [title](path): summary | grade | tags",
    drawer: (title: string): string => `## ${title}`,
  },

  grades: {
    title: "grades",
    suffix: "legend",
    concept: "concept",
    conceptNote: "No grade. A concept is a timeless reference, not a project to adopt.",
    example: "example",
  },

  spec: {
    grade: "grade",
    drawer: "drawer",
    tags: "tags",
    path: "path",
  },

  note: {
    what: "What it is",
    useWhen: "Use when",
    doNotUseWhen: "Do NOT use when",
    details: "Details",
    evidence: "Evidence",
    evidenceDone: ": done",
    evidenceNotYet: "· not yet",
    links: "Linked notes",
    usedBy: "Used by",
    usedByNote: "Services on this node that point here for their recipe.",
  },

  degraded: {
    note: "The notes below are the copy this node already holds.",
    link: "Knowledge base service",
  },

  notFound: {
    kicker: "not found",
    browse: "Browse the knowledge base",
    drawerTitle: "No such drawer",
    drawerBody: "The knowledge base has six drawers: projects, devices, recipes, protocols, local models and concepts.",
    noteTitle: "No such note",
    noteBody: (drawer: string, slug: string): string => `The ${drawer} drawer has no note called "${slug}".`,
    openDrawer: (drawer: string): string => `Open the ${drawer} drawer`,
    elsewhereTitle: "That note is in another drawer",
    elsewhereBody: (title: string, drawer: string): string => `"${title}" is filed in the ${drawer} drawer.`,
    openNote: "Open the note",
  },
} as const

/** The notes the demo's service pages point at that the L0 catalog does not carry. */
export const KB_EXTRA_NOTES: readonly NoteText[] = [
  // ---- RECIPES ------------------------------------------------------------
  {
    id: "set-up-a-radio-board",
    drawer: "recipes",
    title: "Set up a radio board",
    grade: "testing",
    summary: "A plugged-in radio board: allowed once, flashed, then set to a region.",
    tags: ["install", "radio"],
    what: "The steps that make a radio board on USB part of this node. The node asks before it touches the board, identifies it, writes firmware from its own signed release when the board has none, and waits for a region before it sends anything.",
    useWhen: [
      "A radio board was just plugged into this node.",
      "A board has no usable firmware yet, or lost it in a failed write.",
    ],
    doNotUseWhen: [
      "The region is unknown: the board must not send until one is picked.",
      "The board already runs and only its name should change.",
    ],
    details: [
      "Plug the board into a USB port. The node notices it and waits.",
      "Allow the node to identify the board, once.",
      "When the board has no usable firmware, type its name to confirm; the node writes firmware from its own signed release.",
      "Pick the region the board is in. It sends nothing before that.",
      "The radio starts, and the mesh link tries the preferred networks in order.",
    ],
    links: ["radio-box", "flash-mesh-firmware", "preferred-networks", "radio-airtime-budget"],
  },

  // ---- CONCEPTS (no grade) ------------------------------------------------
  {
    id: "local-agent",
    drawer: "concepts",
    title: "Local agent",
    grade: null,
    summary: "The node's own model: the main interface and the health monitor.",
    tags: ["agent", "model"],
    what: "A local model that runs as the node's agent. It is the main way to talk to the node, and it watches the health of every layer the device runs. A lighter device borrows a nearby hub's agent over the local mesh.",
    useWhen: [
      "A question about the node should be asked in plain words instead of read from logs.",
      "A failure needs a diagnosis, and a fix tested in a sandbox before anyone approves it.",
    ],
    doNotUseWhen: [
      "Hardware or commands must be touched directly: the agent proposes, a person accepts.",
      "The device cannot spare the memory; it borrows a nearby hub's agent instead.",
    ],
    links: ["small-local-model", "sandbox-first", "adopt-before-build"],
  },
  {
    id: "preferred-networks",
    drawer: "concepts",
    title: "Preferred networks",
    grade: null,
    summary: "A short, ordered list of existing networks, tried one after another.",
    tags: ["mesh", "transport"],
    what: "Existing mesh networks are treated as pure transport. The node keeps a short list of preferred networks, kept in this library, and tries them in order. When one is found it starts heartbeats and data exchange; when none is in range it falls back down the list.",
    useWhen: [
      "Explaining why the node joined one network and not another.",
      "A new device should join the same networks without any setup.",
    ],
    doNotUseWhen: ["Routing inside one network is the question; each network keeps its own routing."],
    links: ["thin-bridge", "long-range-mesh-firmware", "radio-airtime-budget"],
  },
  {
    id: "gateway-role",
    drawer: "concepts",
    title: "Gateway role",
    grade: null,
    summary: "Any node that reaches the internet becomes a gateway while online.",
    tags: ["gateway", "presence"],
    what: "A role, not a device. A node that reaches the internet says so and becomes a gateway between the offline mesh and the wider network. A laptop that gets online now and then flushes its waiting messages; an always-on node passes messages into the local mesh as they arrive. Offline again, it stays a plain mesh node.",
    useWhen: [
      "Explaining why waiting messages left the moment a laptop got online.",
      "Working out where messages cross between the mesh and the wider network.",
    ],
    doNotUseWhen: [
      "A kind of device is meant: the role comes from being online, never from hardware.",
      "A radio relay should hold it; a relay has neither the links nor the compute.",
    ],
    links: ["store-and-forward", "preferred-networks"],
  },
  {
    id: "store-and-forward",
    drawer: "concepts",
    title: "Store-and-forward",
    grade: null,
    summary: "Holds a sealed message until a path to its reader opens.",
    tags: ["messaging", "offline"],
    what: "A sealed message goes straight to the other node when it can be reached. When it cannot, a node that stays on, such as the home hub, takes a sealed copy and holds it until the other end comes back. Only the two ends can read it. Delivery comes first; speed is optional.",
    useWhen: [
      "The other node is away, asleep or out of range.",
      "Links come and go, as on long-range radio or a laptop that is online now and then.",
    ],
    doNotUseWhen: ["Both ends must talk live: holding a copy trades speed for delivery."],
    links: ["four-delivery-states", "gateway-role", "store-and-forward-envelope"],
  },
  {
    id: "thin-bridge",
    drawer: "concepts",
    title: "Thin bridge",
    grade: null,
    summary: "Joins channels that cannot hear each other, carrying only the minimum.",
    tags: ["bridge", "transport"],
    what: "A bridge joins channels that cannot talk to each other, such as long-range radio and Wi-Fi. It stays thin: it carries only the small common format across, never reads the sealed payload and never rebuilds the radio's own routing.",
    useWhen: [
      "A node has a radio, plus Wi-Fi that can host a hotspot or an ethernet port.",
      "Phones on Wi-Fi should reach nodes that only speak long-range radio.",
    ],
    doNotUseWhen: [
      "The node has only one way to talk; a bridge needs two.",
      "More than carrying frames is wanted: a bridge never reads or rewrites the payload.",
    ],
    details: [BRIDGE_REASON.buffer],
    links: ["preferred-networks", "radio-box", "radio-airtime-budget"],
  },
  {
    id: "capacity-pruning",
    drawer: "concepts",
    title: "Capacity pruning",
    grade: null,
    summary: "A full store frees space by capacity alone, never by a timer.",
    tags: ["storage"],
    what: "Each node keeps its own encrypted store. Nothing expires on a timer and no rule caps what is kept: when space runs short, the store frees room by capacity alone. Big shared libraries, such as regional maps, live on hubs and travel over Wi-Fi.",
    useWhen: [
      "Explaining why old data left the store when space ran short.",
      "Deciding what a small device keeps and what it borrows from a hub.",
    ],
    doNotUseWhen: ["Data must vanish after a set time: the store has no expiry rules."],
    links: ["store-and-forward", "radio-airtime-budget"],
  },
  {
    id: "sandbox-first",
    drawer: "concepts",
    title: "Sandbox first",
    grade: null,
    summary: "Every fix runs in a sandbox before a person approves it.",
    tags: ["agent", "repair"],
    what: "When something breaks, the agent finds the cause and tests a fix in a sandbox inside the node. Only a fix that passes there is offered, and a person approves it before anything changes. A fix that fails never leaves the sandbox.",
    useWhen: [
      "A layer this device runs fails or slows down.",
      "A fix arrives from another node through a gateway: this node checks it again in its own sandbox, then its owner approves.",
    ],
    doNotUseWhen: ["Nobody can approve: the node waits at the human gate, however long that takes."],
    details: [
      "The fix leaves this node as a pull request, and maintainers review it upstream.",
      HEAL_RAIL_LINE,
      "Nothing moves past a human gate by itself.",
    ],
    links: ["local-agent", "gateway-role", "adopt-before-build"],
  },
]
