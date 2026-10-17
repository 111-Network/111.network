import { describe, expect, it } from "vitest"
import { TICKER_DURATION_S, TICKER_ITEMS, TICKER_LINE, TICKER_SEPARATOR } from "./ticker-items"

// Plan §4.3, verbatim.
const PLAN_LINE =
  "Offline First /// Any Device Is A Node /// One Command /// Keys Made On Your Device /// No Phone Number. No Email. /// Local AI /// Local Dashboard /// End-To-End Encrypted /// Store & Forward /// Delivery Is Non-Negotiable /// No Rate Limits /// No Forced Expiry /// Existing Networks Are Allies /// Radio / Wi-Fi / Bluetooth /// Heartbeats /// Gateways To The World /// Self-Healing /// Humans Have The Final Say /// Adopt, Don't Reinvent /// Runs On People /// Open Source"

describe("ticker items", () => {
  it("are exactly the plan §4.3 list, in order, joined by ' /// '", () => {
    expect(TICKER_LINE).toBe(PLAN_LINE)
    expect(TICKER_ITEMS).toHaveLength(21)
    expect(TICKER_SEPARATOR).toBe("///")
  })

  it("keeps 'Open Source' word for word as the last item (W6)", () => {
    expect(TICKER_ITEMS[TICKER_ITEMS.length - 1]).toBe("Open Source")
  })

  it("are unique (they double as React keys)", () => {
    expect(new Set(TICKER_ITEMS).size).toBe(TICKER_ITEMS.length)
  })

  it("drop the items that contradict the final logic", () => {
    const line = TICKER_LINE.toLowerCase()
    for (const gone of ["satellite", "anonymous", "decentralized"]) {
      expect(line).not.toContain(gone)
    }
  })

  it("have a positive marquee duration", () => {
    expect(TICKER_DURATION_S).toBeGreaterThan(0)
  })
})
