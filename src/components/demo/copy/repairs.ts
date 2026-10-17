// Copy for the Repairs service view (#/services/repairs, Layer 9). Owned by the Repairs view task:
// every user-visible sentence of the page, its log and its events lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). No code and no numbers in a fix: a change
// is described the way a person would say it. Only REPAIRS_ prefixed names are exported.
//
// The wording follows the Layer 9 section of the home page (plan §5 L9) and the W13 gate rail in
// src/lib/heal.ts, so the home page and the demo tell the same story.

type DiffOp = "add" | "remove" | "keep"

interface DiffLineCopy {
  op: DiffOp
  text: string
}

interface FixCopy {
  /** One plain line: what the fix does. */
  summary: string
  /** The plain-English diff: no code, no numbers. */
  diff: readonly DiffLineCopy[]
}

interface FaultCopy {
  /** The layer in prose, lowercase ("messaging"). */
  layerWord: string
  /** The broken service's reason sentence while it is in ERROR. */
  reason: string
  /** What the agent notices, lowercase, no full stop. */
  symptom: string
  /** The cause it finds, lowercase, no full stop. */
  diagnosis: string
  /** The proposal title. */
  title: string
  fix: FixCopy
  /** The careless fix behind "[DEMO] try a bad fix", and why the sandbox catches it. */
  badFix: FixCopy & { failNote: string }
}

const REJECTED = "fix rejected: nothing leaves the sandbox"

const FAULTS = {
  outbox: {
    layerWord: "messaging",
    reason: "Messages stay in the outbox after a link comes back.",
    symptom: "messages stay in the outbox after a link comes back",
    diagnosis: "the outbox stops retrying once a link has dropped",
    title: "Retry the outbox when a link comes back",
    fix: {
      summary: "retry the outbox whenever any link comes back",
      diff: [
        { op: "keep", text: "keep every message until its recipient's node confirms it" },
        { op: "remove", text: "stop retrying a message once its link drops" },
        { op: "add", text: "retry the outbox whenever any link comes back" },
      ],
    },
    badFix: {
      summary: "restart the whole node whenever a link drops",
      diff: [
        { op: "keep", text: "keep every message until its recipient's node confirms it" },
        { op: "remove", text: "stop retrying a message once its link drops" },
        { op: "add", text: "restart the whole node whenever a link drops" },
      ],
      failNote: "presence went quiet during every restart",
    },
  },
  links: {
    layerWord: "transport",
    reason: "Stopped when its link dropped for a moment, and has not started again.",
    symptom: "the mesh link stopped when its link dropped for a moment, and never started again",
    diagnosis: "it gives up when the link it uses disappears, instead of waiting for it to come back",
    title: "Keep the mesh link running when a link drops",
    fix: {
      summary: "keep running and listen again as soon as a link comes back",
      diff: [
        { op: "keep", text: "try the preferred networks in the order you set" },
        { op: "remove", text: "stop when the link in use disappears" },
        { op: "add", text: "keep running and listen again as soon as a link comes back" },
      ],
    },
    badFix: {
      summary: "restart the mesh link whenever it stops",
      diff: [
        { op: "keep", text: "try the preferred networks in the order you set" },
        { op: "keep", text: "stop when the link in use disappears" },
        { op: "add", text: "restart the mesh link whenever it stops" },
      ],
      failNote: "it still stops each time its link drops",
    },
  },
  store: {
    layerWord: "storage",
    reason: "The cleaner that frees room stopped answering.",
    symptom: "the cleaner that frees room when space runs short stopped answering",
    diagnosis: "it stops at the first copy already handed over, so it never reaches the rest",
    title: "Free copies already handed over first",
    fix: {
      summary: "free copies already handed over first, then superseded updates",
      diff: [
        { op: "remove", text: "stop at the first copy already handed over" },
        { op: "add", text: "free copies already handed over and public data you can fetch again first" },
        { op: "add", text: "then superseded updates, then your own oldest history" },
        { op: "keep", text: "never free anything not yet delivered" },
      ],
    },
    badFix: {
      summary: "free room by deleting the oldest items, whatever they are",
      diff: [
        { op: "remove", text: "stop at the first copy already handed over" },
        { op: "remove", text: "never free anything not yet delivered" },
        { op: "add", text: "free room by deleting the oldest items, whatever they are" },
      ],
      failNote: "messages not yet delivered were deleted",
    },
  },
} as const satisfies Readonly<Record<string, FaultCopy>>

/** The three sandbox checks, in strip order (plan §5 L9 and §6.4). */
const CHECKS = {
  sandbox: { pass: "applied in a sandbox", failName: "applied in a sandbox" },
  replay: { pass: "failure replayed: gone", failName: "failure replayed" },
  others: { pass: "other layers untouched", failName: "other layers" },
} as const

const DIFF_WORD: Readonly<Record<DiffOp, string>> = { add: "Adds", remove: "Removes", keep: "Keeps" }

export const REPAIRS_COPY = {
  faults: FAULTS,
  checks: CHECKS,
  rejected: REJECTED,

  /** The repairs service's own reason while it works (core/serviceTransition on "repairs", state unchanged). */
  reasons: {
    working: (noun: string): string => `Working on a fault in the ${noun}.`,
    waiting: "A fix passed every check in the sandbox. It waits for your approval.",
    rejected: (noun: string): string => `A fix failed in the sandbox, so nothing was applied. The ${noun} stays broken.`,
    dismissed: (noun: string): string => `You dismissed the fix. The ${noun} stays broken until you approve one.`,
  },

  /** Why "[DEMO] simulate a fault" waits. */
  simulateHint: {
    busy: "The agent works on one fault at a time. This one still waits for a person.",
    notLive: "Repairs is not running, so nothing can be repaired right now.",
    nothingLive: "Every part a fault could break is already down.",
    ready: (word: string): string => `One part of the ${word} layer breaks, and the agent takes it from there.`,
  },

  matrix: {
    title: "health",
    suffix: "every layer this device runs",
    heading: "Health of every layer",
    intro: "The agent watches every layer this device runs. Layers without a service of their own are watched as part of the node.",
    layerColumn: "layer",
    partsColumn: "watched parts",
    allWell: "Nothing is broken on the layers this device runs.",
    problem: (names: string, one: boolean): string => `${names} ${one ? "needs" : "need"} a repair.`,
    starting: (names: string, one: boolean): string => `${names} ${one ? "is" : "are"} starting again.`,
    /** The parts of the node itself, for the layers that have no service of their own. */
    builtIn: { 1: "Updater", 2: "Node keypair", 4: "This dashboard" },
    repairedAt: (clock: string): string => `repaired at ${clock}`,
  },

  run: {
    title: "repair",
    heading: (title: string): string => `Repair: ${title}`,
    noneTitle: "Nothing to repair right now.",
    noneBody:
      "When something breaks, the agent finds the cause, builds a fix and tests it in a sandbox. Nothing changes on this node until you approve it.",
    stepsLabel: "what the agent does",
    steps: ["diagnose", "build a fix", "test in a sandbox"],
    stepState: { done: "done", working: "working", waiting: "waiting" },
    working: ["finding the cause", "building a fix", "testing it in a sandbox"],
    workingBad: ["finding the cause", "building the bad fix you asked for", "testing it in a sandbox"],
    changeLabel: "the change, in plain words",
    changeBad: "the bad fix, in plain words",
    changePending: "No change yet: the agent is still finding the cause.",
    diffSr: { add: "added: ", remove: "removed: ", keep: "unchanged: " },
    diffLegend: "added: inverted · removed: struck through",
    checksLabel: "sandbox checks",
    checkState: { waiting: "waiting", pass: "pass", fail: "fail" },
    badFix: "try a bad fix",
    badFixNote: "The agent builds the careless fix you ask for and tests it the same way.",
    rejectedDetail: (noun: string): string => `The ${noun} stays broken. Nothing was applied, and nothing went upstream.`,
    proper: "Build a proper fix",
    dismissedLine: (word: string): string => `dismissed: nothing was applied, ${word} stays broken`,
    retry: "Try again",
    readyLine: "Every check passes. Approve it on this node, on the gate rail below.",
    agentLine: "The same proposal waits in the Agent view.",
    agentLink: "Open the Agent",
    dismiss: "Dismiss",
    dismissConfirm: "Dismiss this fix",
    appliedLine: (word: string): string => `applied on this node · ${word} is running again`,
    /** The pull request's state badge (plan §5 L9 bench), plain words. */
    badge: {
      working: "DRAFT",
      ready: "WAITING FOR YOU",
      rejected: "CLOSED · REJECTED",
      dismissed: "CLOSED · DISMISSED",
      approved: "APPROVED HERE",
      upstream: "OPEN UPSTREAM",
      reviewed: "REVIEWED UPSTREAM",
      merged: "MERGED",
    },
    by: "written by the local agent",
  },

  /** The proposal the agent writes once every check passes (shown in the Agent view too). */
  proposalBody: (fault: FaultCopy): string =>
    [
      `What broke: ${fault.symptom}.`,
      `Cause: ${fault.diagnosis}.`,
      ...fault.fix.diff.map((line) => `${DIFF_WORD[line.op]}: ${line.text}.`),
      `Checks in the sandbox: ${CHECKS.sandbox.pass} · ${CHECKS.replay.pass} · ${CHECKS.others.pass}.`,
      "Approve it on this node and it goes upstream as a pull request for the maintainers. Nothing changes until you do.",
    ].join("\n\n"),

  rail: {
    title: "gate rail",
    suffix: "people decide",
    heading: "Gate rail",
    intro: "People have the final say, here and on every node the fix reaches.",
    state: {
      passed: "passed",
      idle: "not reached",
      arriving: "the fix is on its way",
      waitingYou: "waiting for you",
      waitingMaintainers: "waiting for the maintainers",
      waitingOwner: "waiting for node B's owner",
    },
    approveConfirm: "Apply this fix on this node",
    ownerConfirm: "Approve it as node B's owner",
    approveHint: "enabled after the checks pass",
    rejectedHint: REJECTED,
    legend: "filled: passed · bright outline: waits for a person · dim: passes by itself when the fix arrives",
    forever: "A real node waits at a person's gate for as long as it takes. Nothing here moves past one by itself.",
  },

  log: {
    title: "repair log",
    empty: "Nothing written yet. When something breaks, the agent notes every step here.",
    who: {
      agent: "agent",
      sandbox: "sandbox",
      you: "you",
      maintainers: "maintainers",
      gateway: "gateway",
      "node-b-agent": "node B's agent",
      "node-b-owner": "node B's owner",
    },
    noticed: (word: string, symptom: string): string => `noticed: ${word}: ${symptom}`,
    diagnosis: (text: string): string => `diagnosis: ${text}`,
    built: (summary: string): string => `built a fix: ${summary}`,
    builtBad: (summary: string): string => `built the bad fix you asked for: ${summary}`,
    passed: "every check passes",
    failed: (name: string, note: string): string => `${name}: ${note}`,
    rejected: REJECTED,
    proposal: "wrote a proposal: it waits for your approval",
    askedBad: "asked for a bad fix",
    withdrawn: "set the tested fix aside to test the one you asked for",
    dismissed: (word: string): string => `dismissed it: nothing was applied, ${word} stays broken`,
    askedProper: "asked for a proper fix",
    retried: "asked the agent to try again",
    /** Past-tense line per gate station, in HEAL_GATES order. */
    stations: [
      "approved it on this node",
      "sent it upstream as a pull request",
      "reviewed it upstream",
      "merged the proven fix",
      "carried it to node B",
      "checked it again in its own sandbox: every check passes",
      "approved it on node B",
    ],
  },

  shared: {
    title: "fixes shared",
    emptyTitle: "No fixes shared yet.",
    emptyBody:
      "A fix leaves this node only after you approve it here. It reaches another node only after the maintainers merge it, that node's own agent checks it again and its owner approves it.",
    entry: (layer: string): string => `${layer} · merged upstream · checked again and approved on node B`,
  },

  /** Event sentences (the shell's live region reads them; Overview's activity can list them). */
  events: {
    fault: (name: string, symptom: string): string => `${name} broke: ${symptom}.`,
    diagnosed: (text: string): string => `The agent found the cause: ${text}.`,
    built: "The agent built a fix and is testing it in a sandbox.",
    builtBad: "The agent built the bad fix you asked for and is testing it in a sandbox.",
    passed: "The fix passed every check in the sandbox. It waits for your approval.",
    withdrawn: "The agent set its tested fix aside to test the bad one you asked for.",
    applied: (name: string): string => `The fix was applied on this node. ${name} is starting again.`,
    appliedOnly: "The fix was applied on this node.",
    upstream: "The fix went upstream as a pull request.",
    reviewed: "The maintainers reviewed it upstream.",
    merged: "The proven fix was merged upstream.",
    gateway: "A gateway carried the fix to node B.",
    rechecked: "Node B's own agent checked it again in its sandbox: every check passes. It waits for node B's owner.",
    shared: (title: string): string => `Fix shared: ${title}. One repair healed another node.`,
    proper: "The agent is building a proper fix.",
    retried: "The agent is looking at the fault again.",
  },
} as const
