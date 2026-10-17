// Copy for the Internet gateway service page (#/services/gateway, Layer 7; os/README.md "Relay &
// Presence": nodes that reach the internet advertise it and become gateways; one that is online
// only now and then flushes its waiting queue whenever it gets online; offline, it stays a pure
// mesh participant). Owned by the Nearby view task: every user-visible sentence of the page lives
// here, in plain words (W1, W5; scripts/check-copy.mjs scans these literals). Export only names
// prefixed GATEWAY_ (or grow the one GATEWAY_COPY object) so the copy/index.ts barrel never collides.

export const GATEWAY_COPY = {
  /** The second demo button: back to a pure mesh node. The first is DEMO_ACTIONS.internet. */
  disconnect: "drop the internet connection",

  // ------------------------------------------------------------------------------------------ role
  role: {
    title: "role",
    suffix: "overlay",
    node: "node",
    chip: "node chip",
    chipSame: (badge: string): string => `${badge}, unchanged`,
    internet: "internet",
    connected: "connected",
    offline: "offline",
    role: "role",
    gateway: "gateway, while it stays online",
    checking: "checking the internet",
    meshNode: "mesh node",
    online: "online",
    onlineSince: (at: string): string => `since ${at}`,
    lastOnline: (from: string, to: string): string => `last time ${from} to ${to}`,
    never: "not yet",
    times: "times online",
    explain: (badge: string): string =>
      `The gateway is a role, not a device. This laptop earns it by reaching the internet and holds it only while it stays online, so its node chip still reads ${badge}.`,
    nowAndThen:
      "A laptop is online only now and then. Each time it gets online it sends the messages waiting in its outbox; while it is offline the mesh keeps working without it.",
    alwaysOn: "An always-on node with a steady connection would also bring messages from the wider network into the mesh as they arrive.",
    pureMesh: "Without the internet this node is a pure mesh node again: it still hears, relays and holds messages for the mesh.",
  },

  // -------------------------------------------------------------------------------------- presence
  presence: {
    title: "presence",
    suffix: "heard nodes",
    online: "While this node is online, the nodes it hears can reach the wider network through it.",
    offline: "These nodes are heard over the mesh. Nobody reaches the internet through this node while it is offline.",
    empty: "No nearby nodes heard yet. A gateway serves whichever nodes can hear it.",
    openNearby: "Open Nearby",
  },

  // ---------------------------------------------------------------------------------------- outbox
  outbox: {
    title: "outbox",
    suffix: "when online",
    flushed: (at: string): string => `Waiting messages left the outbox through the internet at ${at}.`,
    pending: "Anything waiting in the outbox goes out while this node is online.",
    offline: "Messages that need the wider network wait in the outbox until this node gets online again.",
    openMessages: "Open Messages",
  },

  // ------------------------------------------------------------------------------------------- log
  log: {
    title: "gateway",
    suffix: "log",
    empty: "Not online yet since the demo opened.",
    online: "reached the internet: this node is a gateway",
    flushed: "waiting messages went out",
    offline: "internet lost: a pure mesh node again",
  },
} as const
