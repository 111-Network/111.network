// Pure display logic of the Devices views: the board's steps, the list prompt, the missing-text
// sentence, facts in plain words, the agent hand-off and this laptop's bridge row (bootstrap rule).
import { describe, expect, it } from "vitest"
import { DEVICE_COPY } from "../../copy/core"
import { DEVICES_COPY } from "../../copy/devices"
import { MIN, SEC } from "../../engine/clock"
import type { RadioStage } from "../../engine/types"
import {
  ADD_DEVICE_PATH,
  aliasFromDraft,
  boardStep,
  deviceAgentAction,
  drivenByText,
  firmwareText,
  isLikely,
  listPrompt,
  missingText,
  needsFirmware,
  ownBridgeText,
  presenceText,
  showsRegion,
} from "./model"

const STAGES: readonly RadioStage[] = ["plugged", "identifying", "identified", "flashing", "flashed", "ready"]
const idle = { consentDeclined: false, flashOpen: false }

describe("the board's setup steps", () => {
  it("one step per stage, consent first, ready last", () => {
    expect(STAGES.map((s) => boardStep(s, idle))).toEqual(["consent", "identifying", "offer", "flashing", "region", "ready"])
  })

  it("Not now turns the consent into the declined step; an open confirmation turns the offer into confirm", () => {
    expect(boardStep("plugged", { consentDeclined: true, flashOpen: false })).toBe("declined")
    expect(boardStep("identified", { consentDeclined: false, flashOpen: true })).toBe("confirm")
  })

  it("the list prompts only until the board is identified; flashing and later happen on its page", () => {
    expect(listPrompt(null, false)).toBe("none")
    expect(STAGES.map((s) => listPrompt(s, false))).toEqual(["consent", "identifying", "identified", "none", "none", "none"])
    expect(listPrompt("plugged", true)).toBe("declined")
  })
})

describe("missingText (real flash-model wording)", () => {
  it("says nothing when complete, and names what is left otherwise", () => {
    expect(missingText([])).toBe("")
    expect(missingText(["erase", "own", "name"])).toBe("Still needed: tick both boxes and type the name exactly as shown.")
    expect(missingText(["erase"])).toBe("Still needed: tick the first box.")
    expect(missingText(["own", "name"])).toBe("Still needed: tick the second box and type the name exactly as shown.")
    expect(missingText(["name"])).toBe("Still needed: type the name exactly as shown.")
  })
})

describe("facts in plain words", () => {
  it("is only likely before the consented identify; needs firmware while it is offered", () => {
    expect(STAGES.filter(isLikely)).toEqual(["plugged", "identifying"])
    expect(STAGES.filter(needsFirmware)).toEqual(["identified", "flashing"])
    expect(STAGES.filter(showsRegion)).toEqual(["flashed", "ready"])
  })

  it("the firmware row follows the stage, with no names and no versions", () => {
    const f = DEVICES_COPY.detail.firmware
    expect(STAGES.map(firmwareText)).toEqual([f.unknown, f.checking, f.none, f.writing, f.mesh, f.mesh])
    for (const s of STAGES) expect(firmwareText(s)).not.toMatch(/\d/)
  })

  it("nothing drives the board until its region is set", () => {
    expect(STAGES.map(drivenByText)).toEqual(["nothing yet", "nothing yet", "nothing yet", "nothing yet", "nothing yet", "Long-range radio"])
  })

  it("presence reads 'a few seconds' at first, then a duration", () => {
    expect(presenceText(0, 5 * SEC)).toBe("for a few seconds")
    expect(presenceText(0, 3 * MIN)).toBe("for 3 min")
    expect(presenceText(10, 0)).toBe("for a few seconds")
  })

  it("an empty draft or the detected name clears the alias", () => {
    expect(aliasFromDraft("  ", "USB radio board")).toBeNull()
    expect(aliasFromDraft(" USB radio board ", "USB radio board")).toBeNull()
    expect(aliasFromDraft(" Bench radio ", "USB radio board")).toBe("Bench radio")
  })

  it("Add device lives at /devices/add", () => {
    expect(ADD_DEVICE_PATH).toBe("/devices/add")
  })
})

describe("the agent hand-off", () => {
  it("sets up a board that needs it, fixes an error, asks about anything else", () => {
    expect(deviceAgentAction("needs setup", "USB radio board")).toMatchObject({ goal: "setup", prompt: "Set up the USB radio board on this node and test it." })
    expect(deviceAgentAction("error", "USB radio board").goal).toBe("fix")
    expect(deviceAgentAction("connected", "USB radio board")).toMatchObject({ goal: "check", label: DEVICES_COPY.detail.agentLabel.check })
  })
})

describe("this laptop's bridge row (bootstrap rule, plan §6.8)", () => {
  const hotspot = { hotspot: true, ethernet: false }
  it("claims the bridge only when the facts allow it", () => {
    expect(ownBridgeText(true, hotspot, true)).toBe(`${DEVICE_COPY.ownBridges}: ${DEVICES_COPY.own.whyHotspot}.`)
    expect(ownBridgeText(true, { hotspot: false, ethernet: true }, true)).toContain(DEVICES_COPY.own.whyEthernet)
  })

  it("otherwise says what is missing and never the bridge sentence", () => {
    const cases = [ownBridgeText(false, hotspot, false), ownBridgeText(false, hotspot, true), ownBridgeText(false, { hotspot: false, ethernet: false }, true)]
    expect(cases).toEqual([DEVICES_COPY.own.notYetNoRadio, DEVICES_COPY.own.notYetSetup, DEVICES_COPY.own.noLink])
    for (const t of cases) expect(t).not.toContain(DEVICE_COPY.ownBridges)
    // Even a stray `bridges` flag cannot claim it without a hotspot or ethernet.
    expect(ownBridgeText(true, { hotspot: false, ethernet: false }, true)).toBe(DEVICES_COPY.own.noLink)
  })
})
