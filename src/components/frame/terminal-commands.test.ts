import { describe, expect, it } from "vitest"
import {
  COMMAND_ALIASES,
  COMMAND_NAMES,
  DEVICES_HANG,
  HELP_HANG,
  HELP_HINT,
  HELP_ROWS,
  LAYERS_HANG,
  POLICY_HANG,
  INITIAL_INTERPRETER_STATE,
  LICENSE_LINE,
  POLICY_LINES,
  WELCOME_LINE,
  WHOAMI_SEED,
  parseLayerArg,
  resolveCommand,
  runCommand,
  type CommandResult,
  type InterpreterState,
  type TerminalContext,
} from "@/components/frame/terminal-commands"
import { DEVICES, DEVICE_IDS, SUPPORT_LABELS, type DeviceId } from "@/lib/devices"
import { HEAL_GATES, HEAL_RAIL_LINE } from "@/lib/heal"
import { groupedLabel, isGroupedLabel } from "@/lib/labels"
import { LAYERS } from "@/lib/layers"
import {
  ASCII_LOGO,
  DEMO_PATH,
  GITHUB_URL,
  INSTALL_COMMANDS,
  INSTALL_NOTES,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_VERSION,
} from "@/lib/site"

const CTX: TerminalContext = { device: "laptop", demoReady: false, installLive: false }
const S0 = INITIAL_INTERPRETER_STATE

function run(input: string, ctx: Partial<TerminalContext> = {}, state: InterpreterState = S0): CommandResult {
  return runCommand(input, state, { ...CTX, ...ctx })
}

function texts(res: CommandResult): string[] {
  return res.lines.map((line) => line.text)
}

function joined(res: CommandResult): string {
  return texts(res).join("\n")
}

describe("welcome", () => {
  it("is the exact plan wording", () => {
    expect(WELCOME_LINE).toBe("111 Network demo terminal. Type help. Nothing here touches a network.")
  })
})

describe("parsing", () => {
  it("prints nothing for blank input", () => {
    for (const input of ["", "   ", "\t"]) {
      const res = run(input)
      expect(res.lines).toEqual([])
      expect(res.typed).toBe(false)
      expect(res.state).toBe(S0)
    }
  })

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(texts(run("  HeLp  "))).toEqual(texts(run("help")))
    expect(texts(run("LAYER 3"))).toEqual(texts(run("layer 3")))
  })

  it("answers unknown commands with command not found + the help hint", () => {
    const res = run("frobnicate now")
    expect(texts(res)).toEqual(["command not found: frobnicate", HELP_HINT])
    expect(res.effect).toBeUndefined()
  })

  it("clips a very long unknown command", () => {
    const res = run("x".repeat(80))
    expect(res.lines[0].text.length).toBeLessThan(60)
    expect(res.lines[0].text.endsWith("…")).toBe(true)
  })

  it("treats removed legacy commands as unknown", () => {
    for (const name of ["stack", "nodes", "inspect", "status", "sections"]) {
      expect(texts(run(name))[0]).toBe(`command not found: ${name}`)
    }
  })

  it("does not resolve prototype keys", () => {
    for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(resolveCommand(name)).toBeNull()
      expect(texts(run(name))[0]).toBe(`command not found: ${name}`)
    }
  })

  it("parses layer arguments", () => {
    expect(parseLayerArg("3")).toBe(3)
    expect(parseLayerArg("03")).toBe(3)
    expect(parseLayerArg("0")).toBe(0)
    expect(parseLayerArg("9")).toBe(9)
    expect(parseLayerArg("L7")).toBe(7)
    expect(parseLayerArg("layer-4")).toBe(4)
    expect(parseLayerArg("#layer-5")).toBe(5)
    for (const bad of ["10", "-1", "x", "3.5", "", "one", "100", "layer"]) expect(parseLayerArg(bad)).toBeNull()
  })
})

describe("help", () => {
  it("lists every command once, in order", () => {
    expect(HELP_ROWS.map(([usage]) => usage.split(" ")[0])).toEqual([...COMMAND_NAMES])
    const out = joined(run("help"))
    for (const [usage, summary] of HELP_ROWS) {
      expect(out).toContain(usage)
      expect(out).toContain(summary)
    }
    expect(out).toContain("open <n>")
  })

  it("every listed command runs (none is unknown)", () => {
    for (const name of COMMAND_NAMES) {
      expect(texts(run(name)).join("\n")).not.toContain("command not found")
    }
  })

  it("rejects arguments", () => {
    expect(texts(run("help me"))).toEqual(["help: takes no arguments", HELP_HINT])
  })
})

describe("layers / layer <n>", () => {
  it("layers lists all ten from LAYERS", () => {
    const res = run("layers")
    for (const layer of LAYERS) {
      expect(res.lines.some((line) => line.text.includes(`${layer.n}  ${layer.title} · ${layer.subtitle}`))).toBe(true)
    }
  })

  it("layer <n> prints the summary and the anchor link", () => {
    for (const layer of LAYERS) {
      const res = run(`layer ${layer.n}`)
      const out = joined(res)
      expect(out).toContain(layer.title)
      expect(out).toContain(layer.subtitle)
      expect(out).toContain(layer.description)
      const anchor = res.lines.at(-1)
      expect(anchor).toEqual({
        text: `-> #layer-${layer.n}`,
        href: `#layer-${layer.n}`,
        label: `Go to Layer ${layer.n}: ${layer.title}`,
      })
      expect(res.effect).toBeUndefined()
    }
  })

  it("layer reports argument errors", () => {
    expect(texts(run("layer"))[0]).toBe("usage: layer <n>   (n is 0 to 9)")
    expect(texts(run("layer 1 2"))[0]).toBe("usage: layer <n>   (n is 0 to 9)")
    expect(texts(run("layer 12"))).toEqual(['layer: no layer "12". Layers run 0 to 9.', HELP_HINT])
    expect(texts(run("layer x"))[0]).toBe('layer: no layer "x". Layers run 0 to 9.')
  })

  it("layers rejects arguments", () => {
    expect(texts(run("layers 3"))[0]).toBe("layers: takes no arguments")
  })
})

describe("goto <n> / open <n>", () => {
  it("scrolls to the layer and prints a line, untyped", () => {
    const res = run("goto 7")
    expect(res.effect).toEqual({ kind: "scroll", layer: 7 })
    expect(res.typed).toBe(false)
    expect(texts(res)[0]).toBe(`jumping to Layer 7 · ${LAYERS[7].title}`)
    expect(res.lines[1].href).toBe("#layer-7")
  })

  it("open is an alias of goto", () => {
    expect(COMMAND_ALIASES.open).toBe("goto")
    expect(resolveCommand("OPEN")).toBe("goto")
    expect(run("open 2")).toEqual(run("goto 2"))
  })

  it("reports argument errors without an effect", () => {
    for (const input of ["goto", "goto 10", "goto x", "open", "open 1 2"]) {
      const res = run(input)
      expect(res.effect).toBeUndefined()
      expect(texts(res).at(-1)).toBe(HELP_HINT)
    }
    expect(texts(run("open"))[0]).toBe("usage: goto <n>   (n is 0 to 9)")
  })
})

describe("devices", () => {
  it("follows the page-level device and shows what it runs, in plain words", () => {
    for (const id of DEVICE_IDS) {
      const device = DEVICES.find((d) => d.id === id)!
      const res = run("devices", { device: id })
      expect(texts(res)[0]).toBe(`Following: ${device.label}`)
      expect(texts(res)).toContain(device.blurb)
      for (const layer of LAYERS) {
        const row = res.lines.find((line) => line.text.trimStart().startsWith(`${layer.n} ${layer.navLabel} `))
        expect(row?.text.endsWith(SUPPORT_LABELS[device.support[layer.n]])).toBe(true)
      }
    }
  })

  it("differs per device", () => {
    expect(joined(run("devices", { device: "radio-relay" }))).not.toBe(joined(run("devices", { device: "gpu-pc" })))
  })

  it("names every device and links to the picker", () => {
    const res = run("devices")
    const out = joined(res)
    for (const device of DEVICES) expect(out).toContain(device.label)
    expect(res.lines.at(-1)?.href).toBe("#layer-1")
  })

  it("never prints category codes", () => {
    for (const id of DEVICE_IDS) {
      expect(joined(run("devices", { device: id }))).not.toMatch(/\b(?:[1-5][AB]|Category|Cat \d)\b/)
    }
  })

  it("rejects arguments", () => {
    expect(texts(run("devices all"))[0]).toBe("devices: takes no arguments")
  })
})

describe("install / phone / sudo", () => {
  it("install prints the host command, the user note and the prerelease note while not live", () => {
    const out = texts(run("install"))
    expect(out).toContain(INSTALL_COMMANDS.host)
    expect(out).toContain(INSTALL_NOTES.user)
    expect(out).toContain(INSTALL_NOTES.prerelease)
    expect(run("install").lines.at(-1)?.href).toBe("#install")
  })

  it("phone prints the phone command", () => {
    const out = texts(run("phone"))
    expect(out).toContain(INSTALL_COMMANDS.phone)
    expect(out).toContain(INSTALL_NOTES.prerelease)
    expect(out).not.toContain(INSTALL_COMMANDS.host)
  })

  it("drops the prerelease note once the installer is live", () => {
    expect(texts(run("install", { installLive: true }))).not.toContain(INSTALL_NOTES.prerelease)
    expect(texts(run("phone", { installLive: true }))).not.toContain(INSTALL_NOTES.prerelease)
  })

  it("defaults to the INSTALL_LIVE constant (false today)", () => {
    expect(texts(runCommand("install", S0, { device: "laptop" }))).toContain(INSTALL_NOTES.prerelease)
  })

  it("sudo answers with the sudo note, whatever follows it", () => {
    for (const input of ["sudo", "sudo install", "SUDO rm -rf /"]) {
      expect(texts(run(input))[0]).toBe(INSTALL_NOTES.sudo)
    }
  })

  it("install and phone reject arguments", () => {
    expect(texts(run("install now"))[0]).toBe("install: takes no arguments")
    expect(texts(run("phone 2"))[0]).toBe("phone: takes no arguments")
  })
})

describe("whoami", () => {
  it("prints a fixed grouped label and says it is display-only", () => {
    const out = texts(run("whoami"))
    expect(out[0]).toBe(groupedLabel(WHOAMI_SEED))
    expect(isGroupedLabel(out[0])).toBe(true)
    expect(out[1]).toMatch(/display-only/)
    expect(texts(run("whoami"))).toEqual(out)
  })

  it("never prints hex", () => {
    expect(texts(run("whoami"))[0]).not.toMatch(/[0189]/)
  })

  it("rejects arguments", () => {
    expect(texts(run("whoami x"))[0]).toBe("whoami: takes no arguments")
  })
})

describe("heal", () => {
  const firstWait = HEAL_GATES.findIndex((gate) => gate.kind !== "machine")

  it("starts a simulation that stops at the first gate needing a person", () => {
    const res = run("heal")
    const out = joined(res)
    expect(out).toContain("sandbox")
    expect(out).toContain(HEAL_RAIL_LINE)
    expect(res.state.heal).toBe(firstWait)
    const waiting = res.lines.find((line) => line.mark === "hollow")
    expect(waiting?.text).toBe(`${HEAL_GATES[firstWait].label} · waiting for a person`)
    expect(out).toContain('"heal approve"')
  })

  it("walks the whole W13 rail only through visitor actions, never on its own", () => {
    let res = run("heal")
    const visited: string[] = []
    let steps = 0
    while (res.state.heal !== null) {
      const gate = HEAL_GATES[res.state.heal]
      visited.push(gate.id)
      const verb = gate.kind === "upstream" ? "next" : "approve"
      // The wrong verb never advances.
      const wrong = run(`heal ${verb === "next" ? "approve" : "next"}`, {}, res.state)
      expect(wrong.state).toEqual(res.state)
      res = run(`heal ${verb}`, {}, res.state)
      steps++
      expect(steps).toBeLessThan(10)
    }
    expect(visited).toEqual(HEAL_GATES.filter((gate) => gate.kind !== "machine").map((gate) => gate.id))
    expect(joined(res)).toMatch(/^done:/m)
  })

  it("prints upstream stations as waiting for people", () => {
    const upstream = HEAL_GATES.findIndex((gate) => gate.kind === "upstream")
    const res = run("heal approve", {}, { heal: firstWait })
    expect(res.state.heal).toBe(upstream)
    expect(res.lines.find((line) => line.mark === "hollow")?.text).toBe(
      `${HEAL_GATES[upstream].label} · waiting for people upstream`,
    )
    expect(joined(res)).toContain(HEAL_GATES[upstream].note)
  })

  it("fills machine stations between the gates", () => {
    const res = run("heal approve", {}, { heal: firstWait })
    const filled = res.lines.filter((line) => line.mark === "filled").map((line) => line.text.split(" · ")[0])
    expect(filled[0]).toBe(HEAL_GATES[firstWait].label)
    expect(filled).toContain("PR UPSTREAM")
  })

  it("explains a wrong verb", () => {
    expect(texts(run("heal next", {}, { heal: firstWait }))[0]).toMatch(/cannot skip it/)
    const upstream = HEAL_GATES.findIndex((gate) => gate.kind === "upstream")
    expect(texts(run("heal approve", {}, { heal: upstream }))[0]).toMatch(/maintainers/)
  })

  it("has nothing to approve before it starts", () => {
    for (const input of ["heal approve", "heal next"]) {
      const res = run(input)
      expect(res.state.heal).toBeNull()
      expect(texts(res)[0]).toMatch(/nothing is waiting/)
    }
  })

  it("restarts from the first gate", () => {
    expect(run("heal", {}, { heal: 6 }).state.heal).toBe(firstWait)
  })

  it("follows the device: light devices ask a nearby hub, a radio relay has no agent", () => {
    expect(joined(run("heal", { device: "laptop" }))).toContain("built a fix on this node")
    expect(joined(run("heal", { device: "old-phone" }))).toContain("asked a nearby hub")
    const relay = run("heal", { device: "radio-relay" })
    expect(relay.state.heal).toBeNull()
    expect(joined(relay)).toContain("does not repair itself")
  })

  it("reports usage errors", () => {
    for (const input of ["heal now", "heal approve twice"]) {
      expect(texts(run(input))[0]).toBe("usage: heal · heal approve · heal next")
    }
  })
})

describe("policy", () => {
  it("prints the four policy lines", () => {
    expect(texts(run("policy"))).toEqual([...POLICY_LINES])
    expect(POLICY_LINES.join(" · ").replace(/\s{2,}/g, " ")).toBe(
      "Rate limits: none · Forced expiry: none · Content policy: none · Pruning: by capacity only",
    )
  })

  it("rejects arguments", () => {
    expect(texts(run("policy x"))[0]).toBe("policy: takes no arguments")
  })
})

describe("demo", () => {
  it("says the demo is coming on its own page while it is not ready, with no link and no path", () => {
    const res = run("demo")
    expect(texts(res)).toEqual(["The dashboard demo is coming soon, on its own page."])
    expect(res.lines.some((line) => line.href)).toBe(false)
    expect(joined(res)).not.toContain(DEMO_PATH)
  })

  it("prints the /demo path and a clickable link once ready", () => {
    const res = run("demo", { demoReady: true })
    expect(joined(res)).toContain(DEMO_PATH)
    expect(res.lines.some((line) => line.href === DEMO_PATH)).toBe(true)
  })

  it("rejects arguments", () => {
    expect(texts(run("demo now"))[0]).toBe("demo: takes no arguments")
  })
})

describe("uninstall", () => {
  it("is plain words with no command line in it", () => {
    const out = joined(run("uninstall"))
    expect(out).toMatch(/uninstaller/)
    expect(out).not.toMatch(/\$|--|sudo|curl|111 uninstall|111-uninstall/)
  })
})

describe("about / version / ascii / clear", () => {
  it("about prints the name, the description and the source link", () => {
    const res = run("about")
    expect(texts(res)).toContain(SITE_NAME)
    expect(texts(res)).toContain(SITE_DESCRIPTION)
    expect(res.lines.some((line) => line.href === GITHUB_URL)).toBe(true)
  })

  it("version prints SITE_VERSION and the license line byte-for-byte (W6)", () => {
    const out = texts(run("version"))
    expect(out.some((line) => line.includes(SITE_VERSION))).toBe(true)
    expect(LICENSE_LINE).toBe("License:    Open Source")
    expect(out).toContain("License:    Open Source")
  })

  it("ascii prints the logo as art with a screen-reader description", () => {
    const res = run("ascii")
    const art = res.lines.filter((line) => line.art).map((line) => line.text)
    expect(art.join("\n")).toBe(ASCII_LOGO)
    expect(res.announce).toMatch(/logo/)
  })

  it("clear empties the screen, untyped", () => {
    const res = run("clear")
    expect(res.effect).toEqual({ kind: "clear" })
    expect(res.lines).toEqual([])
    expect(res.typed).toBe(false)
  })

  it("all reject arguments", () => {
    for (const name of ["about", "version", "ascii", "clear", "uninstall"]) {
      expect(texts(run(`${name} please`))[0]).toBe(`${name}: takes no arguments`)
      expect(run(`${name} please`).effect).toBeUndefined()
    }
  })
})

describe("links", () => {
  const ALL_INPUTS = [...COMMAND_NAMES, "layer 3", "goto 3", "heal", "heal approve"]

  it("every in-page and route link has a clear name without the arrow, keeping its visible words", () => {
    const links = [
      ...ALL_INPUTS.flatMap((input) => run(input).lines),
      ...run("demo", { demoReady: true }).lines,
      ...run("heal", { device: "radio-relay" }).lines,
    ].filter((line) => line.href && line.href !== GITHUB_URL)
    expect(links.length).toBeGreaterThan(0)
    for (const line of links) {
      expect(line.label).toBeTruthy()
      expect(line.label).not.toMatch(/->|#/)
      // Label in name: the visible words, minus the arrow and the raw anchor, are in the label.
      const words = line.text.replace(/\s*->.*$/, "").trim()
      if (words) expect(line.label).toContain(words)
    }
  })

  it("names each layer link after its layer, so repeated links are told apart", () => {
    const labels = LAYERS.map((layer) => run(`layer ${layer.n}`).lines.at(-1)?.label)
    expect(new Set(labels).size).toBe(LAYERS.length)
    expect(run("goto 7").lines[1].label).toBe(`Go to Layer 7: ${LAYERS[7].title}`)
  })

  it("leaves the external source link to its visible text (the component adds the new-tab note)", () => {
    const source = run("about").lines.find((line) => line.href === GITHUB_URL)
    expect(source?.label).toBeUndefined()
  })
})

describe("two-column rows", () => {
  it("help: each summary starts at the hang column", () => {
    const rows = run("help").lines.filter((line) => line.hang !== undefined)
    expect(rows).toHaveLength(HELP_ROWS.length)
    rows.forEach((line, i) => {
      expect(line.hang).toBe(HELP_HANG)
      expect(line.text.slice(HELP_HANG)).toBe(HELP_ROWS[i][1])
      expect(line.text[HELP_HANG - 1]).toBe(" ")
    })
  })

  it("layers: each title starts at the hang column", () => {
    const rows = run("layers").lines.filter((line) => line.hang !== undefined)
    expect(rows).toHaveLength(LAYERS.length)
    rows.forEach((line, i) => {
      expect(line.hang).toBe(LAYERS_HANG)
      expect(line.text.slice(LAYERS_HANG).startsWith(LAYERS[i].title)).toBe(true)
    })
  })

  it("devices: each support label starts at the hang column", () => {
    for (const id of DEVICE_IDS) {
      const device = DEVICES.find((d) => d.id === id)!
      const rows = run("devices", { device: id }).lines.filter((line) => line.hang === DEVICES_HANG)
      expect(rows).toHaveLength(LAYERS.length)
      rows.forEach((line, n) => {
        expect(line.text.slice(DEVICES_HANG)).toBe(SUPPORT_LABELS[device.support[n]])
        expect(line.text[DEVICES_HANG - 1]).toBe(" ")
      })
    }
  })

  it("policy: each value starts at the hang column", () => {
    for (const line of run("policy").lines) {
      expect(line.hang).toBe(POLICY_HANG)
      expect(line.text[POLICY_HANG - 1]).toBe(" ")
      expect(line.text[POLICY_HANG]).not.toBe(" ")
    }
  })

  it("heal: labelled lines hang after their label", () => {
    for (const line of run("heal").lines.filter((l) => l.hang !== undefined)) {
      expect(line.text.slice(0, line.hang)).toMatch(/^(?:[a-z]+: | {2})$/)
    }
  })
})

describe("honesty", () => {
  const ALL = (id: DeviceId) =>
    [...COMMAND_NAMES, "layer 3", "goto 3", "heal", "heal approve"].map((input) => joined(run(input, { device: id }))).join("\n")

  it("prints no network stats or legacy claims", () => {
    for (const id of DEVICE_IDS) {
      const out = ALL(id)
      expect(out).not.toMatch(/\bnodes?:\s*\d|active nodes|messages queued|\d+\s*nearby|\d+s ago|uptime|online:/i)
      expect(out).not.toMatch(/0\.0\.5|111 Mesh|satellite|anonymous|ledger/i)
    }
  })
})
