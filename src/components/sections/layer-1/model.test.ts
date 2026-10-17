import { describe, expect, it } from "vitest"
import { DEVICE_IDS, SUPPORT_LABELS, layerSupport, type DeviceId } from "@/lib/devices"
import type { LayerNumber } from "@/lib/layers"
import * as model from "./model"
import {
  BRIDGE_LINE,
  DEVICE_LOGS,
  GATEWAY_LINE,
  INITIAL_BOOT,
  JOB_WORDS,
  PHONE_FINISH,
  PHONE_STATUS,
  PHONE_TAPS,
  RELAY_SETUP_LINE,
  alsoDoes,
  bootReducer,
  bootView,
  canBeGateway,
  deviceFacts,
  deviceLog,
  deviceParts,
  dioramaArt,
  dioramaLabel,
  narrate,
  ownJob,
  partsAllow,
  phoneStage,
  runKeyOf,
  stripCells,
  tapsFor,
  type BootLine,
  type BootState,
  type Job,
} from "./model"

const ALL: readonly DeviceId[] = DEVICE_IDS
const LAYERS: readonly LayerNumber[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/** The lines a device prints in full: its log, or the phone's finishing lines. */
function fullRun(device: DeviceId): readonly BootLine[] {
  return device === "old-phone" ? PHONE_FINISH : deviceLog(device)
}

function factValue(device: DeviceId, label: string): string | undefined {
  return deviceFacts(device).find((f) => f.label === label)?.value
}

/** Every live-line text the widget can say, for every device and phone step. */
function allNarration(): string[] {
  const out: string[] = []
  for (const device of ALL) {
    for (const acted of [false, true]) {
      for (const animated of [false, true]) {
        for (const finished of [false, true]) {
          for (let taps = 0; taps <= PHONE_TAPS.length; taps++) {
            out.push(narrate({ device, acted, animated, finished, taps }))
          }
        }
      }
    }
  }
  return out
}

/** Every string the module exports, deeply (logs, facts, words, art, narration). */
function allCopy(): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === "object") Object.values(v).forEach(walk)
  }
  walk(Object.values(model).filter((v) => typeof v !== "function"))
  for (const d of ALL) {
    walk(deviceFacts(d))
    walk(fullRun(d))
  }
  for (const stage of ["taps", "starting", "live"] as const) out.push(dioramaArt(stage), dioramaLabel(stage))
  out.push(...allNarration())
  return out
}

/** Index of the first line with exactly `text` (-1 if none). */
function lineIndex(log: readonly BootLine[], text: string): number {
  return log.findIndex((l) => l.text === text)
}

describe("install logs", () => {
  it("cover exactly the layers each device runs, and only those (only what fits)", () => {
    for (const d of ALL) {
      const runs = new Set(fullRun(d).flatMap((l) => l.runs ?? []))
      const partly = new Set(fullRun(d).flatMap((l) => l.partly ?? []))
      for (const n of LAYERS) {
        const support = layerSupport(d, n)
        expect({ d, n, runs: runs.has(n) }).toEqual({ d, n, runs: support === "runs" })
        expect({ d, n, partly: partly.has(n) }).toEqual({ d, n, partly: support === "partly" })
      }
    }
  })

  it("start with the one command line and end with one bold done line", () => {
    for (const d of ALL.filter((x) => x !== "old-phone")) {
      const log = deviceLog(d)
      expect(log[0].kind).toBe("cmd")
      expect(log[log.length - 1].kind).toBe("done")
      expect(log.filter((l) => l.kind === "done")).toHaveLength(1)
    }
  })

  it("never print the install command itself (only the hero, nav popover and terminal do)", () => {
    for (const line of Object.values(DEVICE_LOGS).flat()) {
      expect(line.text).not.toMatch(/curl|https?:|install\.sh|\| sh/)
    }
  })

  it("radio relay: set up once from a nearby computer", () => {
    expect(deviceLog("radio-relay").some((l) => l.text.startsWith(RELAY_SETUP_LINE))).toBe(true)
    expect(RELAY_SETUP_LINE).toBe("set up once from a nearby computer")
  })

  it("radio relay: its identity is made on the computer and handed over, with no claim about what the computer keeps", () => {
    const log = deviceLog("radio-relay")
    const identity = log.filter((l) => l.runs?.includes(2))
    expect(identity.map((l) => l.text)).toEqual(["identity made on the computer and handed to the relay"])
    for (const line of log) expect(line.text).not.toMatch(/wipe|delete|erase|keeps no|no copy/i)
  })

  it("small box: the facts name radio + hotspot Wi-Fi, and the log says it also bridges", () => {
    expect(factValue("radio-box", "has")).toBe("radio + Wi-Fi that can host a hotspot (or a network cable)")
    expect(BRIDGE_LINE).toBe("it also bridges radio and Wi-Fi")
    const log = deviceLog("radio-box")
    const bridge = lineIndex(log, BRIDGE_LINE)
    expect(bridge).toBeGreaterThan(0)
    // It is worked out from the hardware: after "reading hardware", before the install.
    expect(bridge).toBeGreaterThan(lineIndex(log, "reading hardware"))
    expect(bridge).toBeLessThan(lineIndex(log, "installing only what fits"))
    expect(log[bridge].runs).toContain(6)
  })

  it("prints the bridge line exactly when the device's attached parts allow a bridge (bootstrap rule)", () => {
    for (const d of ALL) {
      const log = fullRun(d)
      const bridges = partsAllow("bridge", deviceParts(d))
      const at = lineIndex(log, BRIDGE_LINE)
      expect({ d, line: at >= 0 }).toEqual({ d, line: bridges })
      if (bridges) {
        expect(log.filter((l) => l.text === BRIDGE_LINE)).toHaveLength(1)
        expect(at).toBeGreaterThan(lineIndex(log, "reading hardware"))
      } else {
        // No other wording claims a bridge either.
        for (const line of log) expect({ d, text: line.text, bridge: /bridg/i.test(line.text) }).toMatchObject({ bridge: false })
      }
    }
  })

  it("old phone: no typed log; the diorama asks for taps, then the installer finishes", () => {
    expect(deviceLog("old-phone")).toEqual([])
    expect(PHONE_TAPS.length).toBeGreaterThan(0)
    expect(PHONE_FINISH[PHONE_FINISH.length - 1].text).toBe("phone online · dashboard ready")
    expect(PHONE_FINISH.some((l) => l.text.includes("identity made on the phone itself"))).toBe(true)
  })

  it("the local AI is offered, never forced (it runs only if you agree, or is borrowed)", () => {
    for (const d of ALL) {
      const ai = fullRun(d).filter((l) => l.runs?.includes(3) || l.partly?.includes(3))
      if (layerSupport(d, 3) === "none") expect(ai).toEqual([])
      else expect(ai.some((l) => /if you agree|borrow|bigger hub/.test(l.text))).toBe(true)
    }
  })
})

describe("plain-word honesty rules", () => {
  it("print no hardware numbers or any digit (no cores, no GB, no counts)", () => {
    for (const text of allCopy()) expect(text).not.toMatch(/\d/)
  })

  it("never name a device category, code or model size (W5)", () => {
    const forbidden = [
      /\bcat(egory)?\b/i,
      /ai-native/i,
      /light terminal/i,
      /user terminal/i,
      /edge relay/i,
      /transport bridge/i,
      /knowledge hub/i,
      /compute hub/i,
      /global gateway/i,
      /\btier\b/i,
    ]
    for (const text of allCopy()) for (const re of forbidden) expect(text).not.toMatch(re)
  })

  it("never records the gateway role at install; it is only something a device can become", () => {
    for (const text of allCopy()) expect(text).not.toMatch(/record/i)
    for (const d of ALL) {
      for (const line of fullRun(d)) expect(line.text).not.toMatch(/gateway/i)
    }
    expect(GATEWAY_LINE).toBe("can become a gateway while it has internet")
  })

  it("shows the gateway line for every device except the radio relay", () => {
    for (const d of ALL) {
      expect({ d, gw: factValue(d, "gateway") }).toEqual({ d, gw: d === "radio-relay" ? undefined : GATEWAY_LINE })
      expect(canBeGateway(d)).toBe(d !== "radio-relay")
    }
  })
})

describe("role inheritance (also does the job of …)", () => {
  const order: readonly Job[] = ["relay", "chat", "bridge", "hub"]

  it("each device's own parts allow its own job", () => {
    for (const d of ALL) expect({ d, ok: partsAllow(ownJob(d), deviceParts(d)) }).toEqual({ d, ok: true })
  })

  it("only lists lighter jobs, and only those its attached parts support", () => {
    for (const d of ALL) {
      for (const job of alsoDoes(d)) {
        expect(order.indexOf(job)).toBeLessThan(order.indexOf(ownJob(d)))
        expect(partsAllow(job, deviceParts(d))).toBe(true)
      }
    }
  })

  it("follows the attached parts: a radio makes a relay, a screen makes a chat node", () => {
    expect(alsoDoes("radio-box")).toEqual(["relay"])
    expect(alsoDoes("gpu-pc")).toEqual(["chat"])
    expect(alsoDoes("home-server")).toEqual([])
    expect(alsoDoes("laptop")).toEqual([])
    expect(alsoDoes("old-phone")).toEqual([])
    expect(alsoDoes("radio-relay")).toEqual([])
    // A hub with a radio plugged in would also bridge and relay (README example).
    expect(partsAllow("bridge", [...deviceParts("gpu-pc"), "radio"])).toBe(true)
    expect(partsAllow("relay", [...deviceParts("gpu-pc"), "radio"])).toBe(true)
  })

  it("prints the line in plain words, and only when there is something to say", () => {
    expect(factValue("radio-box", "also does the job of")).toBe(JOB_WORDS.relay)
    expect(factValue("gpu-pc", "also does the job of")).toBe(JOB_WORDS.chat)
    expect(factValue("laptop", "also does the job of")).toBeUndefined()
  })

  it("names, in the visible 'has' fact, the part behind every 'also does the job of' line", () => {
    const shown: Readonly<Record<Job, RegExp[]>> = {
      relay: [/radio/],
      chat: [/screen/],
      bridge: [/radio/, /hotspot|cable/],
      hub: [/storage|graphics card/],
    }
    for (const d of ALL) {
      const has = factValue(d, "has") ?? ""
      for (const job of alsoDoes(d)) for (const re of shown[job]) expect({ d, job, has }).toMatchObject({ has: expect.stringMatching(re) })
    }
    expect(factValue("gpu-pc", "has")).toBe("a screen and a graphics card that can run a big local AI")
  })

  it("lists device, has and can be first for every device", () => {
    for (const d of ALL) {
      expect(deviceFacts(d).slice(0, 3).map((f) => f.label)).toEqual(["device", "has", "can be"])
    }
  })
})

describe("layer strip", () => {
  it("has ten cells straight from the devices table", () => {
    for (const d of ALL) {
      const cells = stripCells(d)
      expect(cells.map((c) => c.n)).toEqual(LAYERS)
      for (const c of cells) expect(c.support).toBe(layerSupport(d, c.n))
      expect(cells.every((c) => c.name.length > 0 && c.name === c.name.toLowerCase())).toBe(true)
    }
  })

  it("has a word for every support level", () => {
    expect(Object.keys(SUPPORT_LABELS).sort()).toEqual(["none", "partly", "runs"])
  })
})

/** A chip click on `device`: the run is armed first (capture phase), then the store reports the change. */
function chipClick(state: BootState, device: DeviceId): BootState {
  return bootReducer(bootReducer(state, { type: "run", device }), { type: "device", device })
}

/** A device change nobody clicked for (?device=, back/forward, another section). */
function passive(state: BootState, device: DeviceId): BootState {
  return bootReducer(state, { type: "device", device })
}

describe("widget state", () => {
  it("bumps the run on every chip click or REPLAY", () => {
    const s1 = bootReducer(INITIAL_BOOT, { type: "run", device: "laptop" })
    const s2 = bootReducer(s1, { type: "run", device: "laptop" })
    expect([INITIAL_BOOT.run, s1.run, s2.run]).toEqual([0, 1, 2])
    expect(runKeyOf(s1.run, "laptop")).not.toBe(runKeyOf(s2.run, "laptop"))
    expect(runKeyOf(1, "laptop")).not.toBe(runKeyOf(1, "gpu-pc"))
  })

  it("prints the log whole before any click, even for a device from the URL", () => {
    for (const d of ALL) {
      const view = bootView(passive(INITIAL_BOOT, d), d)
      expect({ d, animate: view.animate }).toEqual({ d, animate: false })
      expect(view.stillCount).toBe(d === "old-phone" ? 0 : deviceLog(d).length)
      expect(view.acted).toBe(false)
    }
  })

  it("types only the device the click asked for", () => {
    const clicked = chipClick(INITIAL_BOOT, "gpu-pc")
    expect(bootView(clicked, "gpu-pc").animate).toBe(true)
    expect(bootView(clicked, "laptop").animate).toBe(false)
    const replayed = bootReducer(clicked, { type: "run", device: "gpu-pc" })
    expect(bootView(replayed, "gpu-pc").animate).toBe(true)
    expect(bootView(replayed, "gpu-pc").key).not.toBe(bootView(clicked, "gpu-pc").key)
  })

  it("prints whole after a device change no click asked for, even back on the clicked device", () => {
    const clicked = chipClick(INITIAL_BOOT, "laptop")
    const away = passive(clicked, "gpu-pc")
    expect(bootView(away, "gpu-pc").animate).toBe(false)
    expect(bootView(away, "gpu-pc").stillCount).toBe(deviceLog("gpu-pc").length)
    const back = passive(away, "laptop")
    expect(bootView(back, "laptop").animate).toBe(false)
    expect(bootView(back, "laptop").stillCount).toBe(deviceLog("laptop").length)
    // The next click types again.
    expect(bootView(chipClick(back, "home-server"), "home-server").animate).toBe(true)
  })

  it("keeps the armed run when the store reports the clicked device (or nothing changed)", () => {
    const run = bootReducer(INITIAL_BOOT, { type: "run", device: "radio-box" })
    expect(passive(run, "radio-box")).toBe(run)
    expect(passive(INITIAL_BOOT, "laptop")).toBe(INITIAL_BOOT)
  })

  it("counts taps per run, capped at the taps a human must make", () => {
    const key = runKeyOf(1, "old-phone")
    let s: BootState = INITIAL_BOOT
    expect(tapsFor(s, key)).toBe(0)
    for (let i = 0; i < PHONE_TAPS.length + 2; i++) s = bootReducer(s, { type: "tap", key })
    expect(tapsFor(s, key)).toBe(PHONE_TAPS.length)
    const capped = bootReducer(s, { type: "tap", key })
    expect(capped).toBe(s)
  })

  it("starts a new run with no taps (REPLAY, chip click, other device)", () => {
    const key = runKeyOf(INITIAL_BOOT.run, "old-phone")
    const tapped = bootReducer(bootReducer(INITIAL_BOOT, { type: "tap", key }), { type: "tap", key })
    expect(tapsFor(tapped, key)).toBe(2)
    expect(tapsFor(tapped, runKeyOf(INITIAL_BOOT.run, "laptop"))).toBe(0)
    const replayed = bootReducer(tapped, { type: "run", device: "old-phone" })
    const nextKey = runKeyOf(replayed.run, "old-phone")
    expect(tapsFor(replayed, nextKey)).toBe(0)
    expect(tapsFor(bootReducer(replayed, { type: "tap", key: nextKey }), nextKey)).toBe(1)
  })

  it("phone: the finishing lines stay unshown until the last TAP, which types them", () => {
    let s: BootState = passive(INITIAL_BOOT, "old-phone")
    for (let i = 0; i < PHONE_TAPS.length; i++) {
      const view = bootView(s, "old-phone")
      expect(view).toMatchObject({ tapsDone: false, animate: false, stillCount: 0 })
      s = bootReducer(s, { type: "tap", key: view.key })
    }
    expect(bootView(s, "old-phone")).toMatchObject({ tapsDone: true, animate: true, acted: true })
  })

  it("phone: a chip click alone types nothing until every tap is made", () => {
    const clicked = chipClick(INITIAL_BOOT, "old-phone")
    expect(bootView(clicked, "old-phone")).toMatchObject({ taps: 0, animate: false, stillCount: 0, acted: true })
  })

  it("phone: after leaving and coming back without a click, the finished setup prints whole", () => {
    let s: BootState = chipClick(INITIAL_BOOT, "old-phone")
    const key = bootView(s, "old-phone").key
    for (let i = 0; i < PHONE_TAPS.length; i++) s = bootReducer(s, { type: "tap", key })
    const back = passive(passive(s, "laptop"), "old-phone")
    const view = bootView(back, "old-phone")
    expect(view).toMatchObject({ tapsDone: true, animate: false, stillCount: PHONE_FINISH.length })
    expect(phoneStage(view.taps, view.stillCount >= view.lines.length)).toBe("live")
  })

  it("moves the phone NOT SET → STARTING → LIVE", () => {
    const n = PHONE_TAPS.length
    expect(phoneStage(0, true)).toBe("taps")
    expect(phoneStage(n - 1, true)).toBe("taps")
    expect(phoneStage(n, false)).toBe("starting")
    expect(phoneStage(n, true)).toBe("live")
    expect(PHONE_STATUS).toEqual({ taps: "unset", starting: "starting", live: "live" })
  })
})

describe("diorama", () => {
  it("draws laptop ══ USB-C ══ phone with even rows that fit a phone screen", () => {
    for (const stage of ["taps", "starting", "live"] as const) {
      const rows = dioramaArt(stage).split("\n")
      const width = rows[0].length
      expect(rows.every((r) => r.length === width)).toBe(true)
      expect(width).toBeLessThanOrEqual(44)
      const art = rows.join("\n")
      expect(art).toContain("LAPTOP")
      expect(art).toContain("══ USB-C ══")
      expect(art).toContain("PHONE")
    }
    expect(dioramaArt("taps")).toContain("[ tap ]")
    expect(dioramaArt("live")).toContain("online")
  })
})

describe("narration", () => {
  it("stays silent until the visitor clicks a chip, REPLAY or TAP (no announcement on load)", () => {
    for (const d of ALL) {
      const view = bootView(passive(INITIAL_BOOT, d), d)
      expect(narrate({ device: d, acted: view.acted, animated: false, finished: true, taps: 0 })).toBe("")
    }
    const tapped = bootReducer(INITIAL_BOOT, { type: "tap", key: runKeyOf(0, "old-phone") })
    expect(bootView(tapped, "old-phone").acted).toBe(true)
    expect(bootView(bootReducer(INITIAL_BOOT, { type: "run", device: "laptop" }), "laptop").acted).toBe(true)
  })

  it("says something different at each step of a typed run", () => {
    const base = { device: "laptop" as const, acted: true, taps: 0 }
    const still = narrate({ ...base, animated: false, finished: true })
    const typing = narrate({ ...base, animated: true, finished: false })
    const done = narrate({ ...base, animated: true, finished: true })
    expect(new Set([still, typing, done]).size).toBe(3)
    expect(done).toContain("node online, dashboard ready")
  })

  it("walks the phone through every tap, then starting, then live", () => {
    const base = { device: "old-phone" as const, acted: true }
    const texts = PHONE_TAPS.map((_, taps) => narrate({ ...base, animated: true, finished: true, taps }))
    texts.forEach((t, i) => expect(t).toContain(PHONE_TAPS[i]))
    const n = PHONE_TAPS.length
    expect(narrate({ ...base, animated: true, finished: false, taps: n })).toContain("starting")
    expect(narrate({ ...base, animated: true, finished: true, taps: n })).toContain("live")
  })

  it("says something for every state once the visitor has acted", () => {
    for (const d of ALL) {
      for (const animated of [false, true]) {
        for (const finished of [false, true]) {
          expect(narrate({ device: d, acted: true, animated, finished, taps: 0 }).length).toBeGreaterThan(0)
        }
      }
    }
    expect(allNarration().length).toBeGreaterThan(0)
  })
})
