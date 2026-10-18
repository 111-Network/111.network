// Copy for the Messages view and conversation (#/messages, #/messages/<peer>).
// Owned by that view's task: every user-visible sentence of the view lives here, in plain words
// (W1, W5; scripts/check-copy.mjs scans these literals). Export only names prefixed MESSAGES_
// so the copy/index.ts barrel never collides.
//
// Real source: os/40-interface/ui/src/views/messages/model.ts. The four state sentences, the reason
// sentences, the request notes, the cancel sentences and the compose gate are VERBATIM (plan §6.8:
// "Use the real queued sentences verbatim; never invent reason codes"). The length limit, the
// contacts page, retry, the raw advanced block and every protocol name are left out (plan §6.4, W1).

/** What each delivery state means (real STATE_COPY, verbatim). The UI never says more than the evidence supports. */
export const MESSAGES_STATE_COPY = {
  queued: "In the outbox on this node: there is no path to them yet, their key is missing, or their hub is not yours.",
  sent: "A frame was written to a link. They have not confirmed it yet.",
  relayed: "A mailbox node saved it and will hold it for them.",
  delivered: "Their node acknowledged it. Only that acknowledgement says delivered.",
} as const

/**
 * The reasons this demo shows, by the real (state, code) table, verbatim (REASON_COPY and
 * REASON_COPY_BY_STATE): Bram's hub is not yours (queued, and sent once the internet carried it),
 * and a message you cancelled before it left.
 */
export const MESSAGES_REASON_COPY = {
  hubNotYours: "Their hub is not yours; it is delivered when you meet directly.",
  hubNotYoursSent: "Your hub does not know them, so it cannot hold this for them. Your copy is kept here; it is delivered when you meet directly.",
  cancelled: "You cancelled this before it left. Its words are not sent; an empty placeholder goes in their place so no message number is skipped.",
} as const

/** The sample conversations (sample data; every incoming one carries the "demo message" note). */
export const MESSAGES_SAMPLES = {
  /** The one welcome message that sits in Messages when the demo opens. */
  welcome: "Welcome to the workshop mesh! Write to me here any time. If my phone is away, the hub keeps a sealed copy until I am back.",
  bramIn: "Back on the ridge for the week. The radio box is on the shed roof now.",
  bramOwn: "Hi Bram, can you bring the spare antenna down when you next pass the workshop?",
  /** The held words of the one message request. */
  request: "Hello! I saw your node's card on the workshop board. Could you help us put a radio on the community garden shed?",
  /** Ada's replies, in turn (a few seconds after one of your messages reaches her node). */
  adaReplies: [
    "Got it, thanks! My phone picked it up from the hub.",
    "I am at the workshop until six. Come by any time.",
    "Sounds good. I will bring the spare battery for the bench radio.",
    "Noted. Write any time: the hub holds it while I am away.",
  ],
} as const

export const MESSAGES_COPY = {
  // --- list
  kicker: "messages",
  conversationsHeading: "conversations",
  noConversations: "No conversations yet.",
  noConversationsBody: "A message waits on this node until a path to them opens, and says so.",
  /** "you: …" before the last line of a thread when it is your own message. */
  you: (line: string): string => `you: ${line}`,
  noMessagesYet: "no messages yet",
  unread: (n: number): string => (n > 0 ? `${n} unread` : ""),
  /** Advanced: what is still unresolved in a thread. */
  waiting: (parts: string): string => `waiting: ${parts}`,

  // --- requests (real REQUEST_NOTE, IGNORED_NOTE, IGNORED_HERE_NOTE, FORGET_REQUEST_CONFIRM, verbatim)
  requestsHeading: (n: number): string => `message requests (${n})`,
  requestNote:
    "Someone you have not added wrote to you. Their words are shown as text only and nothing is sent back until you accept. Ignore moves a request out of the way on this device; it stays pending on the node and nothing is sent. Their name here is only a label made from their id.",
  ignoredNote:
    "You ignored these on this device. They stay pending on the node and nothing was sent to them, and they are not counted in the badge. A new message from one of them brings its request back.",
  ignoredHereNote: "You ignored this request on this device. It stays pending on the node and nothing was sent to them. A new message from them brings it back.",
  noNewRequests: "No new requests.",
  ignoredSummary: (n: number): string => `ignored requests (${n})`,
  requestLinkHint: " (a message request, open it to read)",
  accept: "accept",
  ignore: "ignore",
  showAgain: "show again",
  forget: "forget request",
  forgetConfirm: "forget this request (their held words are discarded; if they write again it comes back)",
  requestFrom: (label: string): string => ` the request from ${label}`,
  fromLabel: (label: string): string => ` from ${label}`,
  noHeldMessage: "no message held",
  announce: {
    accepted: (label: string): string => `Accepted the request from ${label}.`,
    ignored: (label: string): string => `Ignored the request from ${label}. It stays pending on the node and nothing was sent.`,
    restored: (label: string): string => `Showing the request from ${label} again.`,
    forgotten: (label: string): string => `Forgot the request from ${label}. Their held words are discarded; if they write again it comes back.`,
    cancelled: "Cancelled. It will not be sent; an empty placeholder goes in its place.",
  },

  // --- conversation
  conversationKicker: "conversation",
  conversationFallback: "Conversation",
  allMessages: "All messages",
  logLabel: (name: string): string => `Conversation with ${name}`,
  notFoundKicker: "not found",
  notFoundTitle: "No conversation with this id",
  notFoundBody: "Nothing was sent to or received from this node.",
  emptyThread: "Nothing here yet.",
  emptyThreadHint: "What you write is kept on this node until a path to them opens; the state under each message says how far it got.",
  received: "received",
  written: "written",
  showDetails: "(show details)",
  arrived: "Arrived on this node. Messages are ordered by when they arrived here.",
  unverifiedTime: "unverified sender time",
  claim: (when: string): string =>
    `The sender says they wrote this at ${when}. That is their own clock and cannot be checked, so messages are ordered by when they arrived here.`,
  /** The custody line under a message your home hub holds (relayed), and once their node collected it (delivered). */
  custody: (hub: string, name: string): string => `custody: ${hub} holds a sealed copy for ${name}. It cannot read it.`,
  custodyDone: (hub: string, name: string): string => `custody: ${hub} held a sealed copy until ${name}'s node collected it. It could not read it.`,
  cancelledLabel: "cancelled",
  cancelledState: "Cancelled by you before it left this node. Nothing of it will be sent.",
  cancelSending: "cancel sending",
  cancelConfirm: "Cancel sending this message",
  cancelAria: (text: string): string => `Cancel sending: ${text}`,
  /** Advanced: what a state means as evidence, in plain words (the real names are protocol names, W1). */
  evidence: {
    in: "received here (not acknowledged to the sender until the contact is accepted, if this was a request)",
    queued: "none: still in the outbox",
    cancelled: "none: cancelled before it left (an empty placeholder goes instead)",
    sent: "a frame written to a link",
    relayed: "a signed custody receipt from a mailbox node for a known member",
    delivered: "an acknowledgement from the recipient",
  },
  advancedLine: (id: string, seq: number, evidence: string): string => `${id} · arrival ${seq} · what this state means: ${evidence}`,
  labelLine: (label: string): string => `${label} · a label made from their id; it is not proof of who they are`,
  copyLabel: "Copy label",
  /** The outbox note and its contextual demo action in a thread with waiting messages. */
  outboxWaiting: "Waiting in the outbox for a path to them. When this node reaches the internet, waiting messages leave the outbox.",
  gatewayLink: "Internet gateway",

  // --- composer (real Composer, verbatim apart from the dropped length limit)
  messageLabel: "Message",
  placeholder: "Write a message",
  send: "send",
  composerNote: "Enter sends, Shift and Enter adds a line. There is no length limit.",
  writeFirst: "Write something first.",
  requestGate: "This is a message request. Accept it to reply; nothing is sent back to them until you do.",

  // --- the messaging service line (real banner.tsx + model.ts messagingBanner / bannerAgent)
  banner: {
    error: "messaging problem",
    starting: "messaging starting",
    unset: "messaging not set up",
    startingFallback: "Messaging is starting.",
    errorFallback: "Messaging has a problem.",
    unsetFallback: "Messaging is not set up yet.",
    fix: "Ask the agent to fix it",
    setup: "Set up messaging with the agent",
    settings: "Messaging settings",
    from: "Messages",
    setupQuestion:
      "Messaging on this node is not working yet. Check why, and walk me through setting it up: enrolling with a home hub, or connecting another 111 node.",
    fixQuestion:
      "Messaging on this node has a problem. Check what is wrong (an unreachable home hub, or a full message store) and tell me the steps to fix it.",
  },

  // --- event sentences (the shell announces each one)
  queuedEvent: "Message queued on this node.",
  deliveredEvent: (name: string): string => `${name}'s node acknowledged your message. Only that says delivered.`,
  newMessageFrom: (name: string): string => `New message from ${name}.`,
  flushedEvent: (n: number): string =>
    n === 1 ? "1 waiting message left the outbox through the internet." : `${n} waiting messages left the outbox through the internet.`,
} as const
