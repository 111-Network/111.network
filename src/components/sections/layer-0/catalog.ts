// Layer 0 sample catalog: the six drawers and their index cards (plan §5 L0).
//
// Every card is a ROLE, never a product (W1). Each one is grounded in a real
// note under os/00-knowledge/ and translated into plain words:
//   long-range-mesh-firmware ← projects/meshtastic · phone-first-mesh-stack ← projects/briar-bramble
//   any-link-network-stack ← projects/reticulum · offline-merge-library ← projects/automerge
//   compact-crypto-library ← projects/monocypher (the KB's one testing entry)
//   radio-box ← devices/heltec-wifi-lora-32-v3 · old-phone, gpu-pc ← os/plan/cross-layer/devices.md
//   flash-mesh-firmware ← recipes/install-meshtastic-on-heltec-wifi-lora-32-v3 · phone-over-usb ← Layer 1
//   signed-event-sync ← protocols/nostr · online-handshake ← protocols/noise-framework
//   store-and-forward-envelope ← protocols/bundle-protocol-v7
//   small-local-model ← models/qwen3-4b · model-runtime ← projects/llama-cpp
//   adopt-before-build ← README "Adopt-vs-build" · four-delivery-states ← concepts/store-and-forward-states
//   radio-airtime-budget ← concepts/lora-airtime-budget
//
// Honest sample: most cards are candidate, a few testing, exactly one proven
// card (labelled "example"); concepts carry no grade. Evidence is never stored
// per card: model.ts derives it from the grade, so a check appears only where
// the grade earned it. Plain data, no React: safe in Server Components.

/** Drawer ids, in cabinet order (= the knowledge folders). */
export const DRAWER_IDS = ["projects", "devices", "recipes", "protocols", "models", "concepts"] as const

/** One of the six drawers. */
export type DrawerId = (typeof DRAWER_IDS)[number]

/** A drawer front: its id (the folder) and its label plate. */
export interface Drawer {
  id: DrawerId
  label: string
}

/** The three evidence grades, weakest first. */
export const GRADES = ["candidate", "testing", "proven"] as const

/** One evidence grade. */
export type Grade = (typeof GRADES)[number]

/** One index card: a small note on one topic. */
export interface CatalogCard {
  /** Vault-wide unique slug, e.g. "radio-box". */
  id: string
  drawer: DrawerId
  /** Role name, never a product name. */
  title: string
  /** Evidence grade; null for concepts (they carry none). */
  grade: Grade | null
  /** Set only on the one proven sample card. */
  example?: true
  /** The one-line verdict the agent reads in the index (at most 12 words). */
  summary: string
  /** Lowercase filter words, at most three. */
  tags: readonly string[]
  /** "What it is". */
  what: string
  /** "Use when". */
  useWhen: readonly string[]
  /** "Do NOT use when". */
  doNotUseWhen: readonly string[]
  /** Linked notes (card ids). */
  links: readonly string[]
}

/** The six drawer fronts, top-left to bottom-right. */
export const DRAWERS: readonly Drawer[] = [
  { id: "projects", label: "PROJECTS" },
  { id: "devices", label: "DEVICES" },
  { id: "recipes", label: "RECIPES" },
  { id: "protocols", label: "PROTOCOLS" },
  { id: "models", label: "LOCAL MODELS" },
  { id: "concepts", label: "CONCEPTS" },
]

/** Every sample card, drawer by drawer. */
export const CARDS: readonly CatalogCard[] = [
  // ---- PROJECTS -----------------------------------------------------------
  {
    id: "long-range-mesh-firmware",
    drawer: "projects",
    title: "Long-range mesh firmware",
    grade: "proven",
    example: true,
    summary: "Radio mesh firmware where every node repeats messages; busy channels get noisy.",
    tags: ["mesh", "radio"],
    what: "Firmware that turns a cheap radio board into a mesh node. Every node repeats each message it hears, with no planned routes.",
    useWhen: [
      "Off-grid text over long-range radio, with no internet and no towers.",
      "Community meshes where nodes join and relay without anyone planning routes.",
    ],
    doNotUseWhen: [
      "Planned multi-hop routes are needed: repeating everything scales poorly as traffic grows.",
      "Steady delivery times matter; they vary with how busy the mesh is.",
    ],
    links: ["radio-box", "flash-mesh-firmware", "radio-airtime-budget"],
  },
  {
    id: "phone-first-mesh-stack",
    drawer: "projects",
    title: "Phone-first mesh stack",
    grade: "candidate",
    summary: "Phone messaging stack that syncs over short-range links, no servers.",
    tags: ["mesh", "phone"],
    what: "A messaging stack built for phones. People meet to swap keys, and messages sync over Bluetooth or local Wi-Fi with no servers and no accounts.",
    useWhen: [
      "Studying how two people introduce their keys in person, done right.",
      "One sync design should run over Bluetooth, local Wi-Fi and the internet alike.",
    ],
    doNotUseWhen: [
      "Keys must be replaced later: it cannot do that without a new account.",
      "Device identity is the goal; it is built around people, not nodes.",
    ],
    links: ["old-phone", "any-link-network-stack"],
  },
  {
    id: "any-link-network-stack",
    drawer: "projects",
    title: "Any-link encrypted network stack",
    grade: "candidate",
    summary: "Encrypted network stack that runs over any link; small community.",
    tags: ["mesh", "offline"],
    what: "A complete network stack with built-in identities and end-to-end encryption that does not care which link carries it.",
    useWhen: [
      "Data must cross whatever link exists: radio, Wi-Fi or a cable.",
      "A simple radio does the sending while a bigger machine handles addresses and encryption.",
    ],
    doNotUseWhen: [
      "A large install base and a wide app ecosystem matter; its community is smaller.",
      "A single maintainer is a risk the deployment cannot take.",
    ],
    links: ["long-range-mesh-firmware", "signed-event-sync"],
  },
  {
    id: "offline-merge-library",
    drawer: "projects",
    title: "Offline merge library",
    grade: "candidate",
    summary: "Merges edits to many small files offline, with no conflicts.",
    tags: ["offline", "sync"],
    what: "A library that turns every edit into a mergeable change, so copies edited apart come back together without a server.",
    useWhen: [
      "Many small notes must merge across nodes that are rarely online together.",
      "Edits travel over store-and-forward links instead of through a server.",
    ],
    doNotUseWhen: [
      "One very large document dominates; it is slower there.",
      "A whole sync product is expected: storage and transport are still left to build.",
    ],
    links: ["adopt-before-build"],
  },
  {
    id: "compact-crypto-library",
    drawer: "projects",
    title: "Compact audited crypto library",
    grade: "testing",
    summary: "Small audited signing and encryption code for tiny chips; one maintainer.",
    tags: ["identity", "offline"],
    what: "A small library of signing and encryption building blocks, with no dependencies, that fits on the tiniest radio boards.",
    useWhen: [
      "The smallest devices need signatures and key exchange in very little memory.",
      "An outside security audit is required, and a pinned, checked copy can be kept.",
    ],
    doNotUseWhen: [
      "More than one maintainer is required and there is no plan to carry a copy.",
      "A complete secure-session protocol is wanted; it ships building blocks only.",
    ],
    links: ["online-handshake", "radio-box"],
  },

  // ---- DEVICES ------------------------------------------------------------
  {
    id: "radio-box",
    drawer: "devices",
    title: "Small box with a radio",
    grade: "testing",
    summary: "Cheap long-range radio board; reflashing switches which mesh it speaks.",
    tags: ["hardware", "mesh", "radio"],
    what: "A low-cost board with a long-range radio and a small chip. The same board can run any of the common mesh firmwares.",
    useWhen: [
      "A cheap mesh node is needed for field trials.",
      "One set of boards should stay switchable between mesh firmwares.",
    ],
    doNotUseWhen: [
      "The best range out of the box is expected: the antenna decides real range.",
      "The seller cannot be checked; copies of this board are common.",
    ],
    links: ["flash-mesh-firmware", "long-range-mesh-firmware", "radio-airtime-budget"],
  },
  {
    id: "old-phone",
    drawer: "devices",
    title: "Old phone",
    grade: "candidate",
    summary: "Spare phone as a node, a dashboard screen or a Wi-Fi island.",
    tags: ["hardware", "phone"],
    what: "A phone set up over USB-C from a computer. It can be a node of its own, a screen for a nearby node, or a small Wi-Fi island for others.",
    useWhen: [
      "A spare phone should rejoin the mesh instead of sitting in a drawer.",
      "A nearby node can lend it the heavy work, such as the local model.",
    ],
    doNotUseWhen: [
      "It must drive a plugged-in radio by itself; phones lean on a nearby node for that.",
      "It must run a local model alone; it borrows one instead.",
    ],
    links: ["phone-over-usb", "small-local-model"],
  },
  {
    id: "gpu-pc",
    drawer: "devices",
    title: "PC with a graphics card",
    grade: "candidate",
    summary: "Runs bigger local models and lends them to weaker nodes nearby.",
    tags: ["hardware", "model"],
    what: "A desktop with a graphics card. It runs every layer, bigger local models included, and nearby phones and laptops can borrow its brain.",
    useWhen: [
      "Weaker devices nearby need heavy reasoning or a code fix written.",
      "It stays switched on for long stretches, so others can count on it.",
    ],
    doNotUseWhen: [
      "Power is scarce off-grid: a small box with a radio draws far less.",
      "It is the only node around; a brain to lend needs someone to borrow it.",
    ],
    links: ["small-local-model", "model-runtime"],
  },

  // ---- RECIPES ------------------------------------------------------------
  {
    id: "flash-mesh-firmware",
    drawer: "recipes",
    title: "Flash mesh firmware onto a small box with a radio",
    grade: "candidate",
    summary: "Install mesh firmware on a small box with a radio, over USB-C.",
    tags: ["install", "mesh", "radio"],
    what: "The written steps that turn a fresh small box with a radio into a running mesh node: flash it over USB-C, then set it up from a phone or a computer.",
    useWhen: [
      "A fresh board needs firmware before its first field test.",
      "A node must be recovered after a failed flash.",
    ],
    doNotUseWhen: [
      "The board already runs a working build and only needs its settings changed.",
      "The firmware is being built from source; that is a separate path.",
    ],
    links: ["radio-box", "long-range-mesh-firmware"],
  },
  {
    id: "phone-over-usb",
    drawer: "recipes",
    title: "Set up an old phone over USB-C",
    grade: "candidate",
    summary: "A computer turns a plugged-in phone into a node; the owner taps.",
    tags: ["install", "phone"],
    what: "The steps a computer runs to make a plugged-in phone a node. The installer shows each tap that only the phone's owner can make.",
    useWhen: [
      "A phone should become a node without typing anything on it.",
      "A computer is at hand to run the one command.",
    ],
    doNotUseWhen: [
      "The phone's owner is not there to make the taps only they can make.",
      "No computer is around; this path starts from one.",
    ],
    links: ["old-phone"],
  },

  // ---- PROTOCOLS ----------------------------------------------------------
  {
    id: "signed-event-sync",
    drawer: "protocols",
    title: "Signed-event sync protocol",
    grade: "candidate",
    summary: "Signed messages that sync after time offline; made for always-on links.",
    tags: ["identity", "sync"],
    what: "A simple protocol of signed events passed through relays. Every event proves who wrote it, with no account server and no registry.",
    useWhen: [
      "Two sides catch up on what changed while a link was down.",
      "An identity must sign offline and be checked anywhere.",
    ],
    doNotUseWhen: [
      "The link is long-range radio: it expects always-on connections and needs adapting first.",
      "Nobody can run the relays and handle their spam.",
    ],
    links: ["any-link-network-stack"],
  },
  {
    id: "online-handshake",
    drawer: "protocols",
    title: "Online handshake framework",
    grade: "candidate",
    summary: "Handshake patterns for fresh session keys when both sides are online.",
    tags: ["identity", "offline"],
    what: "A framework for building handshakes from named patterns, so two online devices agree on fresh session keys and prove who they are.",
    useWhen: [
      "Both devices are online and the link should upgrade to a fresh session.",
      "Two machines must prove who they are to each other without certificates.",
    ],
    doNotUseWhen: [
      "Messages wait in a store-and-forward queue: the handshake needs both sides online at once.",
      "Trust would rest on one implementation that nobody has audited.",
    ],
    links: ["compact-crypto-library"],
  },
  {
    id: "store-and-forward-envelope",
    drawer: "protocols",
    title: "Store-and-forward envelope standard",
    grade: "candidate",
    summary: "Standard envelope for on-and-off links; clock-based expiry rules it out on radio.",
    tags: ["messaging", "offline"],
    what: "A standard envelope for networks whose links come and go: nodes hold each message until a path opens.",
    useWhen: [
      "Talking later to existing gateways built for links that come and go.",
      "Studying how to name and split messages without a shared clock.",
    ],
    doNotUseWhen: [
      "It would be the core on long-range radio: every message must expire by a clock.",
      "Frames are small: its headers take too much of each one.",
    ],
    links: ["four-delivery-states", "radio-airtime-budget"],
  },

  // ---- LOCAL MODELS -------------------------------------------------------
  {
    id: "small-local-model",
    drawer: "models",
    title: "Small all-round local model",
    grade: "candidate",
    summary: "Open model for offline reasoning, code and tools on modest hardware.",
    tags: ["model", "offline"],
    what: "A small open model that reasons, writes code and calls tools offline, on old laptops and similar machines.",
    useWhen: [
      "A model must run offline on modest hardware.",
      "Small and large nodes should share one model family at different sizes.",
      "Calling tools matters more than top benchmark scores.",
    ],
    doNotUseWhen: [
      "Long, many-step tasks need the quality of the largest hosted models.",
      "The device cannot spare the memory; it borrows a nearby node's model instead.",
    ],
    links: ["model-runtime", "gpu-pc"],
  },
  {
    id: "model-runtime",
    drawer: "models",
    title: "Portable model runtime",
    grade: "candidate",
    summary: "Low-level engine that runs compressed local models on plain processors.",
    tags: ["model", "offline"],
    what: "A portable engine that runs compressed local models on an ordinary processor, and on a graphics card when one is present.",
    useWhen: [
      "Small models must run on weak nodes, from small boards up to servers.",
      "Riding the engine most local-model tools already build on.",
    ],
    doNotUseWhen: [
      "A turnkey product is needed: serving and model management are left to build.",
      "Giant models are the goal; they are impractical on it.",
    ],
    links: ["small-local-model"],
  },

  // ---- CONCEPTS (no grade) ------------------------------------------------
  {
    id: "adopt-before-build",
    drawer: "concepts",
    title: "Adopt before build",
    grade: null,
    summary: "If a solid project already exists, use it behind a swappable seam.",
    tags: ["rule"],
    what: "The rule the whole library serves. A proven note that covers the need is adopted, wrapped so it can be swapped out later.",
    useWhen: [
      "Choosing between building a piece and adopting one.",
      "Only testing notes exist: try the best one first on a device that can take the risk.",
    ],
    doNotUseWhen: ["Nothing has reached testing yet; only then is building the answer."],
    links: ["long-range-mesh-firmware", "offline-merge-library"],
  },
  {
    id: "four-delivery-states",
    drawer: "concepts",
    title: "Four delivery states",
    grade: null,
    summary: "Queued, sent, relayed, delivered: each state needs its own evidence.",
    tags: ["delivery", "messaging"],
    what: "Every outgoing message is in one of four states. Each state is a claim, and nothing is shown on a guess.",
    useWhen: [
      "Writing the status text for messages.",
      "Judging what another app's delivered tick really promises.",
    ],
    doNotUseWhen: ["A hop-by-hop link receipt is meant; that belongs to the link, not to these states."],
    links: ["store-and-forward-envelope"],
  },
  {
    id: "radio-airtime-budget",
    drawer: "concepts",
    title: "Radio airtime budget",
    grade: null,
    summary: "Time on air and the law cap what long-range radio carries.",
    tags: ["mesh", "radio"],
    what: "Long-range radio carries short messages, not big files. Physics limits time on air and the law limits how often a radio may send; the network adds no limits of its own.",
    useWhen: [
      "Deciding whether a payload may cross a long-range radio link at all.",
      "Explaining why a large file waits for a faster link.",
    ],
    doNotUseWhen: ["Exact plans for one region are needed: the rules differ by region."],
    links: ["long-range-mesh-firmware", "radio-box"],
  },
]
