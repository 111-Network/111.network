// Copy for the Nearby view (#/nearby; real views/nearby/index.tsx + model.ts, in plain words).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed NEARBY_
// (or grow the one NEARBY_COPY object) so the copy/index.ts barrel never collides.
// The real view names the radio stack it hears through; the demo says "long-range radio" (W2).

/** "1 node" / "3 nodes". */
const nodes = (n: number): string => (n === 1 ? "1 node" : `${n} nodes`)

export const NEARBY_COPY = {
  kicker: "nearby",

  // --------------------------------------------------------------------------- lists (real model.ts)
  heardHeading: "heard by this node",
  /** The count line above the lists (real heardSummary). */
  summary: (n: number): string => `${nodes(n)} heard nearby.`,
  nodes,
  /** One panel per way of hearing (real sourceHeading: "heard via <stack> on <board>"). */
  source: {
    radio: (board: string): string => `heard over long-range radio on ${board}`,
    wifi: "heard over Wi-Fi",
    bluetooth: "heard over Bluetooth",
    internet: "heard over the internet",
    suffix: "nodes heard",
  },
  noneInSource: "This board has not heard another node yet.",
  /** How a node is heard: there is no distance on the radar, only the path. */
  path: {
    direct: "heard directly",
    through: (relay: string): string => `heard through ${relay}`,
  },
  /** Plan §6.8, verbatim. No "read 0" counter. */
  relay: "forwards sealed traffic; cannot read it",
  lastHeard: (ago: string): string => `last heard ${ago}`,
  count: (n: number): string => (n === 1 ? "heard once" : `heard ${n} times`),
  /** Why a node was heard (each blip has a named cause). */
  cause: {
    "radio-ready": "when the radio board started listening",
    "listen-burst": "while you listened",
    "custody-ack": "when it took a sealed copy of your message",
    "network-joined": "when this node joined a network",
    other: "on the mesh",
  },
  firstHeard: (why: string): string => `first heard ${why}`,
  latest: (why: string): string => `latest: ${why}`,
  label: (label: string): string => `label ${label}`,
  footnote:
    "Names and times are what each node says about itself over the air. They are shown as plain text and are never links. A time is a hint, not proof that a node is in range now.",

  // ------------------------------------------------------------------------------ stale lists
  stale: {
    mesh: "Last known list. The mesh link has a problem, so nobody here is confirmed to be in range.",
    radioError: "The long-range radio has a problem, so this is the last list it heard.",
    radioStarting:
      "Last known list. The long-range radio is starting, so the board's newest list of nodes has not arrived yet and nobody here is confirmed to be in range.",
  },

  // ------------------------------------------------------------------- empty states (real nearbyState)
  empty: {
    noMesh: {
      kicker: "no mesh link",
      title: "No mesh link yet",
      text: "This node has no mesh link yet, so it cannot hear anyone. Ask the agent to set one up.",
    },
    meshError: {
      kicker: "problem",
      title: "The mesh link has a problem",
      fallback: "The mesh link has a problem, so nearby nodes cannot be heard right now.",
    },
    noBoard: {
      kicker: "no board",
      title: "No nearby nodes heard",
      text: "None of the preferred networks this node can reach over Wi-Fi or Bluetooth is in range, and there is no radio board to listen with over long-range radio. Plug a board in, then set it up from Devices.",
    },
    unbound: {
      kicker: "no board",
      title: "A radio board is waiting to be set up",
      text: "A radio board is plugged in but not set up yet, so nothing is listening. Finish setting it up from its page in Devices.",
    },
    starting: {
      kicker: "starting",
      title: "The long-range radio is starting",
      fallback: "The long-range radio is starting. The board's list of nodes has not arrived yet.",
    },
    error: {
      kicker: "problem",
      title: "The long-range radio has a problem",
      fallback: "The long-range radio has a problem, so nothing can be heard through it right now.",
    },
    nobody: {
      kicker: "nobody heard",
      title: "No other nodes heard yet",
      text: "The board is listening and has not heard another node yet. Nodes appear here as soon as one is heard.",
    },
  },
  openDevices: "Open Devices",
  openBoard: "Open the radio board",
  radioPage: "Long-range radio page",
  meshPage: "Mesh link page",

  // ------------------------------------------------------------------------------------- home link
  home: {
    title: "home link",
    suffix: "Wi-Fi",
    heading: "your home hub on this Wi-Fi",
    text: "This is the home link, not a mesh neighbour: it holds sealed copies for you and does not count as a nearby node.",
    took: (at: string): string => `took a sealed copy at ${at}`,
  },

  // ----------------------------------------------------------------------------------------- radar
  view: {
    label: "Show nearby nodes as",
    radar: "RADAR",
    list: "LIST",
  },
  radar: {
    title: "radar",
    suffix: "heard nodes",
    loading: "Loading the radar.",
    caption:
      "This node is in the middle. A node appears when it is heard and pulses once each time it is heard again. The rings say how a node is heard, not how far away it is.",
    ringDirect: "directly",
    ringRelay: "through a relay",
    homeLink: "home link · Wi-Fi",
    gateway: "gateway",
    gatewayStarting: "checking",
    internet: "internet",
    /** The radar's accessible name: the same facts as the list. */
    describe: (parts: { self: string; names: readonly string[]; home: string | null; gateway: boolean }): string => {
      const heard = parts.names.length === 0 ? "No nearby nodes heard." : `Heard: ${parts.names.join(", ")}.`
      const home = parts.home ? ` ${parts.home}, your home hub, is shown apart over Wi-Fi.` : ""
      const gw = parts.gateway ? " This node is a gateway to the internet." : ""
      return `Radar. ${parts.self} is in the middle. ${heard}${home}${gw}`
    },
    legend: "on the radar",
    legendEmpty: "Only this node so far.",
  },

  // ---------------------------------------------------------------------------------------- listen
  listen: {
    stop: "stop listening",
    started: "Listening for a minute.",
    since: (at: string): string => `Listening since ${at}.`,
    soFar: (names: string): string => (names === "" ? "Nobody heard yet." : `Heard so far: ${names}.`),
    /** "Ridge repeater twice". */
    times: (name: string, n: number): string => (n === 1 ? name : n === 2 ? `${name} twice` : `${name} ${n} times`),
    done: (names: string): string => `Listened for a minute and heard ${names}.`,
    doneNobody: "Listened for a minute. Nobody was in range.",
    stopped: (after: string, names: string): string => `Stopped listening after ${after}. ${names === "" ? "Nobody was heard." : `Heard ${names}.`}`,
    lost: "Stopped listening: the long-range radio is not running.",
    last: (at: string, text: string): string => `Last listen, ${at}: ${text}`,
  },

  // -------------------------------------------------------------------------------------- presence
  presence: {
    title: "presence",
    suffix: "heartbeats",
    joined: (network: string): string => `This node announces that it is reachable in its heartbeats on ${network}.`,
    alone: "No heartbeats go out yet: none of the preferred networks is in range.",
    gatewayLive: "Its heartbeats also say it can reach the internet, so nearby nodes can send through it.",
    gatewayStarting: "Checking the internet connection before it says so in its heartbeats.",
    gatewayOff: "Any node that gets online becomes a gateway for the mesh while it stays online.",
    gatewayPage: "Internet gateway page",
  },

  // ----------------------------------------------------------------------------------------- agent
  ask: "Ask the agent who is nearby",
  /** Real lib/prompts.ts NEARBY_QUESTION, verbatim. */
  question:
    "Who is nearby? Tell me what this node can hear on the mesh right now, which other nodes it has heard, and what I would need to see more.",
} as const
