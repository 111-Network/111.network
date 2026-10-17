import { describe, expect, it } from "vitest"
import { isGroupedLabel, LABEL_ALPHABET } from "@/lib/labels"
import {
  advanceDecode,
  benchReducer,
  CHECKSUM_LENGTH,
  checkAnnouncement,
  claimsPinnedNode,
  DECODE_DONE,
  DECODE_IDLE,
  DECODE_LEAD,
  decodeFrame,
  decodeTick,
  demoChecksum,
  GENUINE,
  IMPOSTOR,
  INITIAL_BENCH,
  isSealBroken,
  KEY_BAR_COUNT,
  KEY_BAR_MAX,
  keyBars,
  keyNote,
  narrate,
  NO_PINS,
  NODE_KEY,
  NODE_LABEL,
  NODE_REF,
  ORIGINAL_TEXT,
  OTHER_KEY,
  peerLeads,
  sceneFor,
  sealAnnouncement,
  STEPS,
  TEXT_MAX,
  verdictReason,
  type BenchAction,
  type BenchState,
  type PinStore,
} from "./model"

const inAlphabet = (s: string) => [...s].every((ch) => LABEL_ALPHABET.includes(ch))

function run(actions: readonly BenchAction[], from: BenchState = INITIAL_BENCH): BenchState {
  return actions.reduce(benchReducer, from)
}

describe("steps", () => {
  it("are the four plan steps, in order", () => {
    expect(STEPS.map((s) => s.label)).toEqual(["1 INSTALL", "2 ANNOUNCE", "3 TAMPER", "4 SWAP KEY"])
  })
})

describe("label", () => {
  it("is a grouped base32 label, never hex", () => {
    expect(isGroupedLabel(NODE_LABEL)).toBe(true)
    expect(NODE_LABEL).not.toMatch(/^[0-9a-f-]+$/)
  })
})

describe("demoChecksum", () => {
  it("is deterministic and uses the label alphabet", () => {
    const sum = demoChecksum(NODE_KEY, ORIGINAL_TEXT)
    expect(sum).toBe(demoChecksum(NODE_KEY, ORIGINAL_TEXT))
    expect(sum).toHaveLength(CHECKSUM_LENGTH)
    expect(inAlphabet(sum)).toBe(true)
  })

  it("changes when any single character is changed or removed", () => {
    const sealed = demoChecksum(NODE_KEY, ORIGINAL_TEXT)
    for (let i = 0; i < ORIGINAL_TEXT.length; i++) {
      const swapped = ORIGINAL_TEXT.slice(0, i) + (ORIGINAL_TEXT[i] === "x" ? "y" : "x") + ORIGINAL_TEXT.slice(i + 1)
      const removed = ORIGINAL_TEXT.slice(0, i) + ORIGINAL_TEXT.slice(i + 1)
      expect(demoChecksum(NODE_KEY, swapped)).not.toBe(sealed)
      expect(demoChecksum(NODE_KEY, removed)).not.toBe(sealed)
    }
  })

  it("depends on the key", () => {
    expect(demoChecksum(OTHER_KEY, ORIGINAL_TEXT)).not.toBe(demoChecksum(NODE_KEY, ORIGINAL_TEXT))
  })
})

describe("checkAnnouncement", () => {
  it("accepts a first-seen node and pins its key", () => {
    const v = checkAnnouncement(NO_PINS, GENUINE)
    expect(v.kind).toBe("accept")
    expect(v.accepted).toBe(true)
    expect(v.seal).toBe("vouched")
    expect(v.pinnedNow).toBe(true)
    expect(v.pins[NODE_REF]).toBe(NODE_KEY)
    expect(NO_PINS).toEqual({})
  })

  it("accepts a known node presenting its pinned key, without re-pinning", () => {
    const pins = checkAnnouncement(NO_PINS, GENUINE).pins
    const v = checkAnnouncement(pins, GENUINE)
    expect(v.kind).toBe("accept")
    expect(v.pinnedNow).toBe(false)
    expect(v.pins).toBe(pins)
  })

  it("rejects tampered text: seal broken, pins untouched", () => {
    const pins = checkAnnouncement(NO_PINS, GENUINE).pins
    const v = checkAnnouncement(pins, { ...GENUINE, text: "workshop laptop is offline" })
    expect(v.kind).toBe("reject-tampered")
    expect(v.accepted).toBe(false)
    expect(v.seal).toBe("broken")
    expect(v.pins).toBe(pins)
  })

  it("rejects tampered text even from a node never seen, and pins nothing", () => {
    const v = checkAnnouncement(NO_PINS, { ...GENUINE, text: "hello" })
    expect(v.kind).toBe("reject-tampered")
    expect(v.pins).toBe(NO_PINS)
  })

  it("rejects a swapped key for a known node: first key seen wins", () => {
    const pins = checkAnnouncement(NO_PINS, GENUINE).pins
    const v = checkAnnouncement(pins, IMPOSTOR)
    expect(v.kind).toBe("reject-swapped")
    expect(v.accepted).toBe(false)
    expect(v.seal).toBe("wrong-key")
    expect(v.pins).toBe(pins)
    expect(v.pins[NODE_REF]).toBe(NODE_KEY)
  })

  it("pinned keys never change: the genuine key still passes after an impostor", () => {
    const pins = checkAnnouncement(NO_PINS, GENUINE).pins
    const afterImpostor = checkAnnouncement(pins, IMPOSTOR).pins
    expect(checkAnnouncement(afterImpostor, GENUINE).kind).toBe("accept")
    expect(checkAnnouncement(afterImpostor, IMPOSTOR).kind).toBe("reject-swapped")
  })

  it("whichever key is seen first is the one pinned", () => {
    const pins = checkAnnouncement(NO_PINS, IMPOSTOR).pins
    expect(pins[NODE_REF]).toBe(OTHER_KEY)
    expect(checkAnnouncement(pins, GENUINE).kind).toBe("reject-swapped")
  })

  it("checks the seal before the pin: tampered and swapped reads as tampered", () => {
    const pins = checkAnnouncement(NO_PINS, GENUINE).pins
    const v = checkAnnouncement(pins, { ...IMPOSTOR, text: "changed" })
    expect(v.kind).toBe("reject-tampered")
  })

  it("pins per node: another node's key is independent", () => {
    const pins: PinStore = checkAnnouncement(NO_PINS, GENUINE).pins
    const v = checkAnnouncement(pins, sealAnnouncement("ridge-relay", OTHER_KEY, "relay up"))
    expect(v.kind).toBe("accept")
    expect(v.pinnedNow).toBe(true)
    expect(v.pins[NODE_REF]).toBe(NODE_KEY)
    expect(v.pins["ridge-relay"]).toBe(OTHER_KEY)
  })

  it("never reads the label: nothing in an announcement carries it", () => {
    expect(Object.values(GENUINE)).not.toContain(NODE_LABEL)
    expect(Object.values(IMPOSTOR)).not.toContain(NODE_LABEL)
  })
})

describe("sceneFor", () => {
  it("idle: nothing printed, nothing heard", () => {
    const s = sceneFor("idle", ORIGINAL_TEXT)
    expect(s.printed).toBe(false)
    expect(s.heard).toBeNull()
    expect(s.verdict).toBeNull()
    expect(s.pins).toEqual({})
  })

  it("install: printed, no peer yet", () => {
    const s = sceneFor("install", ORIGINAL_TEXT)
    expect(s.printed).toBe(true)
    expect(s.heard).toBeNull()
    expect(s.pins).toEqual({})
  })

  it("announce: seal vouched, accepted, key pinned now", () => {
    const s = sceneFor("announce", ORIGINAL_TEXT)
    expect(s.verdict?.kind).toBe("accept")
    expect(s.verdict?.seal).toBe("vouched")
    expect(s.verdict?.pinnedNow).toBe(true)
    expect(s.pinsBefore).toEqual({})
    expect(s.pins[NODE_REF]).toBe(NODE_KEY)
  })

  it("tamper: untouched text is still accepted against the pin from step 2", () => {
    const s = sceneFor("tamper", ORIGINAL_TEXT)
    expect(s.pinsBefore[NODE_REF]).toBe(NODE_KEY)
    expect(s.verdict?.kind).toBe("accept")
    expect(s.verdict?.pinnedNow).toBe(false)
  })

  it("tamper: edited text breaks the seal and is rejected", () => {
    const s = sceneFor("tamper", "workshop laptop is 0nline")
    expect(s.heard?.text).toBe("workshop laptop is 0nline")
    expect(s.heard?.checksum).toBe(GENUINE.checksum)
    expect(s.verdict?.kind).toBe("reject-tampered")
    expect(s.verdict?.seal).toBe("broken")
    expect(s.pins[NODE_REF]).toBe(NODE_KEY)
  })

  it("swap: the impostor key is rejected and the pin stays", () => {
    const s = sceneFor("swap", "anything typed earlier")
    expect(s.heard?.key).toBe(OTHER_KEY)
    expect(s.heard?.text).toBe(ORIGINAL_TEXT)
    expect(s.verdict?.kind).toBe("reject-swapped")
    expect(s.pins[NODE_REF]).toBe(NODE_KEY)
  })

  it("only step 4 claims a pinned node with another key", () => {
    expect(claimsPinnedNode(sceneFor("idle", ORIGINAL_TEXT))).toBe(false)
    expect(claimsPinnedNode(sceneFor("install", ORIGINAL_TEXT))).toBe(false)
    expect(claimsPinnedNode(sceneFor("announce", ORIGINAL_TEXT))).toBe(false)
    expect(claimsPinnedNode(sceneFor("tamper", "changed"))).toBe(false)
    expect(claimsPinnedNode(sceneFor("swap", ORIGINAL_TEXT))).toBe(true)
  })

  it("notes the heard key against the node's pin, never the label", () => {
    expect(keyNote(sceneFor("install", ORIGINAL_TEXT))).toBe("")
    expect(keyNote(sceneFor("announce", ORIGINAL_TEXT))).toBe("first key heard from this node")
    expect(keyNote(sceneFor("tamper", ORIGINAL_TEXT))).toBe("same as pinned")
    expect(keyNote(sceneFor("swap", ORIGINAL_TEXT))).toBe("not the pinned key")
  })

  it("only step 3 can break the seal", () => {
    expect(isSealBroken("tamper", "x")).toBe(true)
    expect(isSealBroken("tamper", ORIGINAL_TEXT)).toBe(false)
    expect(isSealBroken("swap", "x")).toBe(false)
    expect(isSealBroken("announce", "x")).toBe(false)
  })
})

describe("benchReducer", () => {
  it("starts on an empty slot, nothing printed", () => {
    expect(INITIAL_BENCH.stage).toBe("idle")
    expect(INITIAL_BENCH.printRun).toBe(0)
    expect(sceneFor(INITIAL_BENCH.stage, INITIAL_BENCH.text).printed).toBe(false)
  })

  it("prints once when leaving the empty slot, not on later steps", () => {
    const s = run([
      { type: "select", step: "install" },
      { type: "select", step: "announce" },
      { type: "select", step: "swap" },
      { type: "select", step: "install" },
    ])
    expect(s.printRun).toBe(1)
    expect(s.stage).toBe("install")
  })

  it("any step from the empty slot prints the card", () => {
    const s = run([{ type: "select", step: "swap" }])
    expect(s.printRun).toBe(1)
    expect(sceneFor(s.stage, s.text).printed).toBe(true)
  })

  it("re-selecting the current step changes nothing", () => {
    const s = run([{ type: "select", step: "announce" }])
    expect(benchReducer(s, { type: "select", step: "announce" })).toBe(s)
  })

  it("edits apply only in step 3 and are capped", () => {
    const s = run([{ type: "select", step: "announce" }])
    expect(benchReducer(s, { type: "edit", text: "x" })).toBe(s)
    const t = run([{ type: "select", step: "tamper" }, { type: "edit", text: "y".repeat(TEXT_MAX + 10) }])
    expect(t.text).toHaveLength(TEXT_MAX)
  })

  it("counts a break only when the seal turns broken", () => {
    const s = run([
      { type: "select", step: "tamper" },
      { type: "edit", text: "workshop laptop is onlin" },
      { type: "edit", text: "workshop laptop is onli" },
    ])
    expect(s.breakCount).toBe(1)
    const back = run([{ type: "edit", text: ORIGINAL_TEXT }], s)
    expect(back.breakCount).toBe(1)
    expect(isSealBroken(back.stage, back.text)).toBe(false)
    const again = run([{ type: "edit", text: "changed" }], back)
    expect(again.breakCount).toBe(2)
  })

  it("re-entering step 3 with tampered text breaks the seal again", () => {
    const s = run([
      { type: "select", step: "tamper" },
      { type: "edit", text: "changed" },
      { type: "select", step: "swap" },
      { type: "select", step: "tamper" },
    ])
    expect(s.breakCount).toBe(2)
    expect(s.text).toBe("changed")
  })

  it("restore puts the original text back", () => {
    const s = run([{ type: "select", step: "tamper" }, { type: "edit", text: "changed" }, { type: "restore" }])
    expect(s.text).toBe(ORIGINAL_TEXT)
    expect(sceneFor(s.stage, s.text).verdict?.kind).toBe("accept")
    expect(benchReducer(s, { type: "restore" })).toBe(s)
  })

  it("reset empties the slot, restores the text and keeps counters growing", () => {
    const s = run([
      { type: "select", step: "tamper" },
      { type: "edit", text: "changed" },
      { type: "reset" },
    ])
    expect(s.stage).toBe("idle")
    expect(s.text).toBe(ORIGINAL_TEXT)
    expect(s.printRun).toBe(1)
    expect(s.breakCount).toBe(1)
    expect(benchReducer(s, { type: "reset" })).toBe(s)
    expect(run([{ type: "select", step: "install" }], s).printRun).toBe(2)
  })

  it("counts each reset that empties the slot (the stepper's remount key), never a no-op one", () => {
    expect(INITIAL_BENCH.resetCount).toBe(0)
    expect(benchReducer(INITIAL_BENCH, { type: "reset" })).toBe(INITIAL_BENCH)
    const once = run([{ type: "select", step: "swap" }, { type: "reset" }])
    expect(once.resetCount).toBe(1)
    const twice = run([{ type: "select", step: "install" }, { type: "reset" }, { type: "reset" }], once)
    expect(twice.resetCount).toBe(2)
  })

  it("selecting or editing never bumps the reset count", () => {
    const s = run([
      { type: "select", step: "install" },
      { type: "select", step: "tamper" },
      { type: "edit", text: "changed" },
      { type: "restore" },
    ])
    expect(s.resetCount).toBe(0)
  })
})

describe("layout", () => {
  it("below lg the peer panel leads from step 2 on, the card before that", () => {
    expect(peerLeads("idle")).toBe(false)
    expect(peerLeads("install")).toBe(false)
    expect(peerLeads("announce")).toBe(true)
    expect(peerLeads("tamper")).toBe(true)
    expect(peerLeads("swap")).toBe(true)
  })
})

describe("label decode", () => {
  it("reads whole at the last frame and after", () => {
    expect(decodeFrame(NODE_LABEL, DECODE_DONE, 1)).toBe(NODE_LABEL)
    expect(decodeFrame(NODE_LABEL, DECODE_DONE + 5, 1)).toBe(NODE_LABEL)
  })

  it("starts as noise from the same alphabet, hyphens kept", () => {
    const frame = decodeFrame(NODE_LABEL, 0, 1)
    expect(frame).toHaveLength(NODE_LABEL.length)
    expect(isGroupedLabel(frame)).toBe(true)
    expect(inAlphabet(frame.replace(/-/g, ""))).toBe(true)
  })

  it("locks characters left to right and never unlocks one", () => {
    const chars = NODE_LABEL.replace(/-/g, "")
    for (let tick = 0; tick < DECODE_DONE; tick++) {
      const frame = decodeFrame(NODE_LABEL, tick, 3).replace(/-/g, "")
      const locked = Math.max(0, tick - DECODE_LEAD)
      expect(frame.slice(0, locked)).toBe(chars.slice(0, locked))
    }
  })

  it("is deterministic per run and frame", () => {
    expect(decodeFrame(NODE_LABEL, 1, 2)).toBe(decodeFrame(NODE_LABEL, 1, 2))
  })

  it("progress: whole before any print, from 0 for a new print, capped at done", () => {
    expect(decodeTick(0, DECODE_IDLE)).toBe(DECODE_DONE)
    expect(decodeTick(1, DECODE_IDLE)).toBe(0)
    let p = DECODE_IDLE
    for (let i = 0; i < DECODE_DONE + 3; i++) p = advanceDecode(p, 1)
    expect(p).toEqual({ run: 1, tick: DECODE_DONE })
    expect(decodeTick(1, p)).toBe(DECODE_DONE)
    expect(decodeTick(2, p)).toBe(0)
    expect(advanceDecode(p, 2)).toEqual({ run: 2, tick: 1 })
  })
})

describe("keyBars", () => {
  it("is deterministic, bounded, and differs between keys", () => {
    const a = keyBars(NODE_KEY)
    expect(a).toEqual(keyBars(NODE_KEY))
    expect(a).toHaveLength(KEY_BAR_COUNT)
    for (const bar of a) {
      expect(bar.width).toBeGreaterThanOrEqual(1)
      expect(bar.width).toBeLessThanOrEqual(KEY_BAR_MAX)
      expect(bar.gap).toBeGreaterThanOrEqual(1)
      expect(bar.gap).toBeLessThanOrEqual(2)
    }
    expect(keyBars(OTHER_KEY)).not.toEqual(a)
  })
})

describe("words", () => {
  it("narrates every stage", () => {
    expect(narrate(INITIAL_BENCH)).toContain("1 INSTALL")
    const installed = run([{ type: "select", step: "install" }])
    expect(narrate(installed)).toContain(NODE_LABEL)
    expect(narrate(installed)).toContain("issued by nobody")
    const tampered = run([{ type: "select", step: "tamper" }, { type: "edit", text: "changed" }])
    expect(narrate(tampered)).toContain("rejected")
    expect(narrate(run([{ type: "restore" }], tampered))).toContain("accepted")
    expect(narrate(run([{ type: "select", step: "swap" }]))).toContain("first key seen wins")
  })

  it("states the pin rule per node, not per key, in step 2", () => {
    const v = sceneFor("announce", ORIGINAL_TEXT).verdict
    expect(v && verdictReason(v)).toBe("first key heard from this node: pinned")
    const announced = narrate(run([{ type: "select", step: "announce" }]))
    expect(announced).toContain("first key heard from this node")
    expect(announced).toContain("accepted")
    expect(announced).not.toMatch(/first time this key|key seen for the first time/i)
  })

  it("gives the swap rule as the swap reason", () => {
    const v = sceneFor("swap", ORIGINAL_TEXT).verdict
    expect(v && verdictReason(v)).toBe("pinned keys never change; first key seen wins")
  })

  it("never says anonymous or signs everything", () => {
    const all = [
      narrate(INITIAL_BENCH),
      ...(["install", "announce", "tamper", "swap"] as const).map((step) => narrate(run([{ type: "select", step }]))),
    ].join(" ")
    expect(all).not.toMatch(/anonymous|signs everything/i)
  })
})
