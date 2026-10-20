// Copy for the Storage service view (#/services/storage, Layer 8). Plain words only (W1, W5): no
// sizes, thresholds or percentages anywhere (plan §5 L8, §6.8 "keep storage numbers consistent";
// this page prints none). The free-space order is the home page's L8 wording, verbatim (W3);
// storage.test.ts pins it against src/components/sections/layer-8/model.ts.
// Real counterparts: os/4-interface/ui/src/views/services/fabric-model.ts (STORE_* sentences) and
// store-gauge.tsx (the gauge), translated to words.

/** The numbered free-space order (W3), exactly as home L8 prints it. Rule 3 is followed by the export chip. */
export const STORAGE_FREE_ORDER: readonly { rule: 1 | 2 | 3 | 4; text: string }[] = [
  { rule: 1, text: "copies already handed over + public data you can fetch again" },
  { rule: 2, text: "superseded updates" },
  { rule: 3, text: "your own history, oldest first, after" },
  { rule: 4, text: "NEVER: anything not yet delivered, yours or carried for others" },
]

/** The chip rule 3 waits for (home L8 EXPORT_CHIP). */
export const STORAGE_EXPORT_CHIP = "export offered"

/** The muted note under rule 3 (home L8 RULE3_NOTE). */
export const STORAGE_RULE3_NOTE = "only when rules 1 and 2 cannot make room, and never for data you can fetch again"

export const STORAGE_COPY = {
  // ---------------------------------------------------------------------------- the demo fetch
  fetch: {
    /** Beside the [DEMO] button while nothing has happened yet. */
    source: (hub: string): string => `From ${hub}, your home hub, over Wi-Fi.`,
    /** Plan §6.4 / §6.8: offload to hubs only over Wi-Fi, never over a long-range relay path. */
    radio: "Big datasets are not practical over long-range radio.",
    started: (hub: string): string => `Asking ${hub} for the regional map over Wi-Fi.`,
    receiving: (hub: string): string => `Receiving the regional map from ${hub} over Wi-Fi.`,
    crossing: "The map pushed the store past the line, so space is running short. Freeing room in the fixed order.",
    pruned: (freed: string): string => `Space ran short: freed ${freed} to make room for the rest of the map. Your history stays.`,
    checking: "Checking that every piece of the map matches what the hub announced.",
    done: "The regional map is stored. It is public data you can fetch again, so it is first in line when space runs short.",
    declined:
      "Not kept: the regional map is public data you can fetch again, so it never pushes out your history. Ask the hub for it when you need it.",
    paused: "The fetch paused: the store is not running. It picks up where it left off once the store is back.",
    resumed: "The store is back, so the fetch picked up where it left off.",
    /** Under the button once the map is here. */
    already: "The regional map is stored here. The hub keeps the original, so this copy can go first when space runs short.",
    /** Under the button when the storage service is not running. */
    notLive: "The store must be running to take new data.",
  },

  // --------------------------------------------------------------------------------- the gauge
  gauge: {
    title: "store",
    suffix: "encrypted",
    label: "Store gauge",
    caption: "capacity",
    words: {
      room: "room to spare",
      short: "running short",
      freed: "ran short: room freed",
      full: "full",
    },
    /** The gauge's aria-label: words only, never a percentage (the real gauge says "N percent"). */
    describe: (word: string, holds: string, why: string): string => `Store gauge: ${word}. Holds ${holds}.${why}`,
    holdsNothing: "nothing yet",
    whyFreed: " The map went past the line, then room was freed.",
    whyArriving: " The regional map is arriving.",
    legend: {
      line: "past this line, space runs short",
      arriving: "arriving",
      freed: "freed by the last prune",
      empty: "free space",
    },
  },

  /** Extra spec rows of the store panel (the other four are the Layer 8 specs, src/lib/layers.ts). */
  specs: {
    timers: "Timers",
    timersValue: "none: nothing expires on a timer",
    perSender: "Per-sender limits",
    perSenderValue: "none: only capacity shapes what is kept",
    withinRule: "Within a rule",
    withinRuleValue: "old and large first",
    key: "Store key",
    keyValue: "made from this node's identity, never written to disk",
  },

  /** The optional shared log (os/README.md layer 8): one caption, no viewer (v2). */
  sharedLog: "A small append-only shared log may hold the few things that need shared agreement. It is optional; everything else stays in this node's own store.",

  // ------------------------------------------------------------------------------- the classes
  classes: {
    title: "what it holds",
    suffix: "by class",
    list: [
      {
        id: "history",
        name: "your history",
        body: "Messages you sent and received that were delivered. Freed only when rules 1 and 2 cannot make room, oldest first, after an export is offered.",
        note: "Your messages not yet delivered are never freed.",
      },
      {
        id: "carried",
        name: "messages carried for others",
        body: "Sealed copies this node carries for other nodes; it cannot read them. Copies already handed over go first.",
        note: "Copies not yet delivered are never freed.",
      },
      {
        id: "public",
        name: "public data you can fetch again",
        body: "Shared data from hubs, such as maps. A hub can send it again, so it goes first.",
        note: null,
      },
      {
        id: "updates",
        name: "updates",
        body: "The version this node runs is kept. An update that a newer one replaced goes second.",
        note: null,
      },
    ],
    /** Each stored part, in plain words. */
    kinds: {
      history: "delivered history",
      carried: "not yet delivered",
      handed: "already handed over",
      public: "fetched from a hub earlier",
      map: "the regional map",
      update: "the update this node runs",
      superseded: "an update a newer one replaced",
    },
    /** The rule chip beside each part. */
    rule: (rule: 1 | 2 | 3): string => `rule ${rule}`,
    never: "never freed",
    kept: "kept",
    /** A part's state word. */
    state: {
      held: "held",
      none: "none now",
      freed: "freed just now",
      arriving: "arriving",
      onHub: "on the hub",
    },
  },

  // ------------------------------------------------------------------------ the free-space order
  order: {
    title: "free-space order",
    suffix: "by capacity only",
    notYet: " (not yet)",
    used: " (used by the last prune)",
    /** Plan §5 L8: public data never pushes out your history. */
    history: "Public data you can fetch again never pushes out your history.",
  },

  // ---------------------------------------------------------------------------------- the hubs
  hubs: {
    title: "hubs",
    suffix: "big shared libraries",
    intro: "Big shared libraries live on hubs, not on every node. This node fetches what it needs from a hub on Wi-Fi.",
    /** The shelf of a knowledge hub (os/README.md layer 8; home L8 HUB_SHELF). */
    shelf: "maps, encyclopedias, updates and patches",
    home: "your home hub · Wi-Fi",
    homeHosts: (shelf: string): string => `Hosts ${shelf}.`,
    radio: "heard over long-range radio",
    radioBody: "It hosts the same kind of libraries, but big datasets are not practical over long-range radio, so this node does not fetch them from there.",
    radioNotHeard: "Hubs heard over long-range radio show here once a radio board is set up. Big datasets are not practical over long-range radio.",
    map: "regional map",
    mapState: {
      onHub: "on the hub",
      arriving: "arriving over Wi-Fi",
      held: "a copy stored here",
    },
  },

  // -------------------------------------------------------------------------------- the free log
  log: {
    title: "free log",
    suffix: "what was freed, and why",
    empty: "Nothing freed yet. Nothing expires on a timer: room is freed only when space runs short.",
    /** One line per prune: "regional map → freed …". */
    line: (clock: string, freed: string): string => `${clock}  regional map → freed ${freed}`,
    declined: (clock: string): string => `${clock}  regional map → not kept: it never pushes out your history`,
  },

  // ---------------------------------------------------------------------------- event sentences
  events: {
    pruned: (freed: string): string => `Storage ran short and freed ${freed}.`,
    declined: "The regional map was not kept: it never pushes out your history.",
    paused: "The map fetch paused: the store is not running.",
    resumed: "The map fetch picked up where it left off.",
  },

  /** How freed parts read in a sentence, with their rule. */
  freed: {
    handed: "copies already handed over (rule 1)",
    public: "public data you can fetch again (rule 1)",
    map: "an older regional map (rule 1)",
    superseded: "a superseded update (rule 2)",
    history: "your oldest history (rule 3)",
    and: " and ",
    comma: ", ",
  },
} as const
