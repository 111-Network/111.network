import { DEMO_PATH } from "@/lib/site"

// The one data file for the ten layers (plan §2). Copy is verbatim from plan §5.
// It drives the nav rail, the mobile sheet, section headers/footers, the CTA
// band cells and the terminal's `layers` / `layer <n>` / `goto <n>`.

/** A layer number, 0 through 9. */
export type LayerNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** DOM id of a layer section, e.g. "layer-3". */
export type LayerId = `layer-${LayerNumber}`

/** One label/value row of a layer's spec table. */
export interface LayerSpec {
  label: string
  value: string
}

/** Everything the site knows about one layer. */
export interface Layer {
  /** Layer number, equal to the number on screen. */
  n: LayerNumber
  /** Stable kebab-case slug, e.g. "local-intelligence". */
  slug: string
  /** Section id / anchor, "layer-N". */
  id: LayerId
  /** Ghost number shown in the header, "0N". */
  ghost: string
  /** Short uppercase nav label (plan §4.1), e.g. "INTELLIGENCE". */
  navLabel: string
  /** Section H2, e.g. "Local Intelligence". */
  title: string
  /** Tagline after the title, e.g. "Your node's own mind". */
  subtitle: string
  /** Section description paragraph (plan §5). */
  description: string
  /** Exactly four spec rows. */
  specs: readonly [LayerSpec, LayerSpec, LayerSpec, LayerSpec]
  /** In-demo route, e.g. "#/kb" (plan §6.6). */
  demoHash: string
  /** Full demo deep link, e.g. "/demo#/kb". */
  demoHref: string
}

type LayerInput = Omit<Layer, "id" | "ghost" | "demoHref">

const INPUT: readonly LayerInput[] = [
  {
    n: 0,
    slug: "knowledge",
    navLabel: "KNOWLEDGE",
    title: "Knowledge",
    subtitle: "What every layer reads",
    description:
      "The foundation every other layer reads from. A curated library of small notes on existing projects, hardware and protocols, each graded by the evidence behind it. The local agent reasons from it, the installer pulls recipes from it, and it settles one question again and again: if a solid project already exists, use it.",
    specs: [
      { label: "Format", value: "Small notes, one topic each" },
      { label: "Grades", value: "Candidate, Testing, Proven" },
      { label: "Reader", value: "Agent first, human second" },
      { label: "Rule", value: "Adopt before build" },
    ],
    demoHash: "#/kb",
  },
  {
    n: 1,
    slug: "bootstrap",
    navLabel: "BOOTSTRAP",
    title: "Bootstrap",
    subtitle: "One command, one node",
    description:
      "One command turns a fresh or already-used machine into a node. It reads the hardware, works out what the device can be, creates its identity and installs only what fits. A phone is set up over USB-C from a computer, with a few taps only a human can make. Nothing to configure, and re-running is safe.",
    specs: [
      { label: "Entry point", value: "One command or one tap" },
      { label: "Setup", value: "None required" },
      { label: "Installs", value: "Only what the device needs" },
      { label: "Telemetry", value: "None" },
    ],
    demoHash: "#/settings/l1",
  },
  {
    n: 2,
    slug: "identity",
    navLabel: "IDENTITY",
    title: "Identity",
    subtitle: "Your keys, made here",
    description:
      "Every node makes its own cryptographic identity when it is set up. No sign-up, no phone number, no email, no authority to ask. Others know the node by its public half; the private half never leaves it. Back it up when you care to. Until then, everything just works.",
    specs: [
      { label: "Created", value: "At setup, no sign-up" },
      { label: "Sign-up", value: "None: no phone, no email" },
      { label: "Backup", value: "Optional" },
      { label: "Impostors", value: "Known keys are pinned, never swapped" },
    ],
    demoHash: "#/settings/l2",
  },
  {
    n: 3,
    slug: "local-intelligence",
    navLabel: "INTELLIGENCE",
    title: "Local Intelligence",
    subtitle: "Your node's own mind",
    description:
      "A local model runs on the node as its agent: your main way to talk to the system and its constant health monitor. It runs where the device can handle it and you agree. Lighter devices borrow a nearby hub's model over the local mesh. No cloud in the loop. It can propose fixes; a human decides.",
    specs: [
      { label: "Runs when", value: "The device can and you agree" },
      { label: "Light devices", value: "Borrow a nearby hub" },
      { label: "Cloud", value: "None in the loop" },
      { label: "Final say", value: "A human, always" },
    ],
    demoHash: "#/",
  },
  {
    n: 4,
    slug: "interface-dashboard",
    navLabel: "DASHBOARD",
    title: "Interface & Dashboard",
    subtitle: "Your node's face",
    description:
      "Every node serves its own dashboard. Open it in any browser on your laptop or phone: no account, no cloud, no internet. It shows what is running, who is near, and lets you talk to the local agent. Too small to host it? A nearby hub serves it for you.",
    specs: [
      { label: "Served by", value: "The node itself, or a nearby hub" },
      { label: "Opens in", value: "Any browser" },
      { label: "Works", value: "Fully offline" },
      { label: "One tap away", value: "Overview and Agent" },
    ],
    demoHash: "#/overview",
  },
  {
    n: 5,
    slug: "messaging-data",
    navLabel: "MESSAGING",
    title: "Messaging & Data",
    subtitle: "Delivery first, speed second",
    description:
      "Every message is sealed end to end, signed and kept encrypted on your device. It hops through whatever links exist and counts as delivered only when the recipient's node confirms. No rate limits, no expiry, no rules: only what the link can physically carry. Messages are just the first cargo.",
    specs: [
      { label: "Delivery", value: "Reliable first, speed second" },
      { label: "Privacy", value: "Sealed and signed, end to end" },
      { label: "Limits", value: "Physics and capacity only" },
      { label: "Carries", value: "One fabric, five kinds of traffic" },
    ],
    demoHash: "#/messages",
  },
  {
    n: 6,
    slug: "transport-bridge",
    navLabel: "TRANSPORT",
    title: "Transport & Bridge",
    subtitle: "Ride what already exists",
    description:
      "111 does not reinvent the network. It rides the ones that already exist, as plain transport. A node tries a short, ordered list of preferred networks: when it finds one it joins and starts talking; when it finds none it moves down the list. Where radio and Wi-Fi cannot hear each other, a thin bridge passes only the bare minimum across.",
    specs: [
      { label: "Networks", value: "Reused, never rebuilt" },
      { label: "Joining", value: "Preferred list, in order" },
      { label: "Bridge", value: "Bare minimum only" },
      { label: "Runs on", value: "Bridge boxes and hubs" },
    ],
    demoHash: "#/services/bridge",
  },
  {
    n: 7,
    slug: "relay-presence",
    navLabel: "RELAY",
    title: "Relay & Presence",
    subtitle: "Always here, sometimes online",
    description:
      "Every node keeps announcing that it is reachable. Any node that also has internet says so and becomes a gateway between the offline mesh and the wider world. Laptops and phones flush their queues whenever they get online; always-on gateways stream messages in live. Lose the connection and you simply stay a mesh node.",
    specs: [
      { label: "Presence", value: "Continuous heartbeats" },
      { label: "Gateway", value: "Earned by internet access" },
      { label: "Modes", value: "Flush later or stream live" },
      { label: "Offline", value: "Still a mesh node" },
    ],
    demoHash: "#/nearby",
  },
  {
    n: 8,
    slug: "storage-shared-state",
    navLabel: "STORAGE",
    title: "Storage & Shared State",
    subtitle: "Pruned by capacity only",
    description:
      "Every node keeps its own encrypted store. Nothing expires on a timer and no rule decides what you may keep: when space runs short, the node frees room by capacity alone. Big shared libraries such as offline maps and encyclopedias live on hubs. A small append-only log may hold the few things that need shared agreement.",
    specs: [
      { label: "Store", value: "Encrypted on the device" },
      { label: "Pruning", value: "By capacity only" },
      { label: "Hubs", value: "Host the big libraries" },
      { label: "Shared log", value: "Optional, append-only, small" },
    ],
    demoHash: "#/services/storage",
  },
  {
    n: 9,
    slug: "self-healing-evolution",
    navLabel: "SELF-HEALING",
    title: "Self-Healing & Evolution",
    subtitle: "Fixes itself, asks first",
    description:
      "The local agent watches the health of every layer your device runs. When something breaks it diagnoses the problem, builds a fix and tests it in a safe sandbox. You approve it on your node, and it goes upstream as a pull request for the maintainers. When a proven fix reaches another node, that node's own agent checks it again and its owner has the final say.",
    specs: [
      { label: "Validates", value: "In a sandbox first" },
      { label: "Final say", value: "People, always" },
      { label: "Shares", value: "Proven fixes, via gateways" },
      { label: "Evolves", value: "Agent, knowledge, bridges" },
    ],
    demoHash: "#/services/repairs",
  },
]

/** All ten layers, in order 0..9. */
export const LAYERS: readonly Layer[] = INPUT.map((layer) => ({
  ...layer,
  id: `layer-${layer.n}` as const,
  ghost: `0${layer.n}`,
  demoHref: `${DEMO_PATH}${layer.demoHash}`,
}))

/** True when `n` is an integer 0..9. */
export function isLayerNumber(n: unknown): n is LayerNumber {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 9
}

/** The layer for a known layer number (never undefined). */
export function getLayer(n: LayerNumber): Layer {
  return LAYERS[n]
}

/** The layer for any number (e.g. parsed terminal input), or undefined. */
export function layerByN(n: number): Layer | undefined {
  return isLayerNumber(n) ? LAYERS[n] : undefined
}

/** The layer for a section id such as "layer-3" (a leading "#" is allowed), or undefined. */
export function layerById(id: string): Layer | undefined {
  const clean = id.startsWith("#") ? id.slice(1) : id
  return LAYERS.find((layer) => layer.id === clean)
}

/** DOM id of the section's H2 (target of the section's aria-labelledby). */
export function layerTitleId(n: LayerNumber): string {
  return `layer-${n}-title`
}
