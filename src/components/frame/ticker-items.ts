// The ticker strip under the hero (plan §4.3). React-free, so the server
// ticker and its tests share it.
//
// Removed on purpose because they contradict the final logic: Satellite,
// Anonymous (the identity is a stable keypair), Decentralized (now "Runs On
// People"). "Open Source" stays word for word (W6).

/** The ticker items, in plan order. */
export const TICKER_ITEMS = [
  "Offline First",
  "Any Device Is A Node",
  "One Command",
  "Keys Made On Your Device",
  "No Phone Number. No Email.",
  "Local AI",
  "Local Dashboard",
  "End-To-End Encrypted",
  "Store & Forward",
  "Delivery Is Non-Negotiable",
  "No Rate Limits",
  "No Forced Expiry",
  "Existing Networks Are Allies",
  "Radio / Wi-Fi / Bluetooth",
  "Heartbeats",
  "Gateways To The World",
  "Self-Healing",
  "Humans Have The Final Say",
  "Adopt, Don't Reinvent",
  "Runs On People",
  "Open Source",
] as const

/** One ticker item. */
export type TickerItem = (typeof TICKER_ITEMS)[number]

/** Drawn between items; decorative, so it is hidden from screen readers. */
export const TICKER_SEPARATOR = "///"

/** The items as one line, the way the strip reads ("Offline First /// Any Device Is A Node /// …"). */
export const TICKER_LINE: string = TICKER_ITEMS.join(` ${TICKER_SEPARATOR} `)

/**
 * Seconds for one copy of the list to scroll past: about the legacy ticker's
 * pace (~86 px/s at text-xs) for the longer list. Set as an inline
 * animation-duration, because `--marquee-duration` resolves on :root in
 * globals.css and cannot be overridden per element.
 */
export const TICKER_DURATION_S = 52

/** Accessible name of the item list. */
export const TICKER_LABEL = "Key ideas"
