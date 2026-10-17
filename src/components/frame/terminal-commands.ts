import { DEVICES, SUPPORT_LABELS, deviceById, layerSupport, type DeviceId } from "@/lib/devices"
import { HEAL_GATES, HEAL_RAIL_LINE, waitsForVisitor, type HealGate } from "@/lib/heal"
import { groupedLabel } from "@/lib/labels"
import { LAYERS, getLayer, isLayerNumber, type LayerNumber } from "@/lib/layers"
import {
  ANCHORS,
  ASCII_LOGO,
  DEMO_PATH,
  DEMO_READY,
  GITHUB_URL,
  INSTALL_COMMANDS,
  INSTALL_LIVE,
  INSTALL_NOTES,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_VERSION,
  type InstallTarget,
} from "@/lib/site"

// The finale terminal's interpreter (plan §4.4). Pure and React-free: input
// text + interpreter state + page context in, printed lines + next state (+ an
// optional effect the component runs in its event handler) out. Every command
// is covered by terminal-commands.test.ts.

/** The first line on screen, before anything is typed (exact wording, plan §4.4). */
export const WELCOME_LINE = "111 Network demo terminal. Type help. Nothing here touches a network."

/** Printed after an unknown command or a usage error. */
export const HELP_HINT = 'Type "help" for available commands.'

/** One printed line of output. */
export interface OutputLine {
  text: string
  /** "bright" = foreground (titles, commands, labels); default is muted output. */
  tone?: "bright"
  /** Render the whole line as a link: "#id" scrolls in-page, "/path" is a route, "https://" opens a new tab. */
  href?: string
  /**
   * The link's accessible name (and its live-region wording) when the visible
   * text reads badly aloud ("-> #layer-3"). It keeps the visible words.
   */
  label?: string
  /** Hanging indent in ch: wrapped text continues under this column (two-column rows). */
  hang?: number
  /** A CSS square drawn before the text (never a glyph): "filled" = reached, "hollow" = waiting. */
  mark?: "filled" | "hollow"
  /** Decorative ASCII art: hidden from screen readers (the result's `announce` describes it). */
  art?: boolean
}

/** What the interpreter remembers between commands. */
export interface InterpreterState {
  /** Index into HEAL_GATES of the station the `heal` walk waits at; null when no walk is open. */
  heal: number | null
}

/** The interpreter's state before any command. */
export const INITIAL_INTERPRETER_STATE: InterpreterState = { heal: null }

/** A side effect the component runs in its event handler. */
export type TerminalEffect = { kind: "clear" } | { kind: "scroll"; layer: LayerNumber }

/** Page facts a command may read, collected in the event handler. */
export interface TerminalContext {
  /** The page-level followed device (getCurrentDevice()). */
  device: DeviceId
  /** Override for tests; defaults to DEMO_READY. */
  demoReady?: boolean
  /** Override for tests; defaults to INSTALL_LIVE. */
  installLive?: boolean
}

/** The outcome of one command. */
export interface CommandResult {
  lines: readonly OutputLine[]
  state: InterpreterState
  effect?: TerminalEffect
  /** Type the lines one by one (false = print whole, e.g. before a scroll). */
  typed: boolean
  /** Screen-reader text when the printed lines read badly (ASCII art). */
  announce?: string
}

interface Ctx {
  device: DeviceId
  demoReady: boolean
  installLive: boolean
}

type Handler = (args: readonly string[], state: InterpreterState, ctx: Ctx) => CommandResult

/** Every command, in help order. */
export const COMMAND_NAMES = [
  "help",
  "layers",
  "layer",
  "goto",
  "devices",
  "install",
  "phone",
  "sudo",
  "whoami",
  "heal",
  "policy",
  "demo",
  "uninstall",
  "about",
  "version",
  "ascii",
  "clear",
] as const

/** One command name. */
export type CommandName = (typeof COMMAND_NAMES)[number]

/** Extra spellings of a command. */
export const COMMAND_ALIASES: Readonly<Record<string, CommandName>> = { open: "goto" }

/** The help list: usage and one plain line, in COMMAND_NAMES order. */
export const HELP_ROWS: readonly (readonly [usage: string, summary: string])[] = [
  ["help", "show this list"],
  ["layers", "the ten layers, 0 to 9"],
  ["layer <n>", "one layer, in short"],
  ["goto <n>", "jump to a layer (also: open <n>)"],
  ["devices", "the device this page follows"],
  ["install", "the install command for this machine"],
  ["phone", "the install command for an attached phone"],
  ["sudo", "about sudo"],
  ["whoami", "a sample node label"],
  ["heal", "walk a repair through its gates"],
  ["policy", "what a node limits"],
  ["demo", "the dashboard demo"],
  ["uninstall", "how removal works"],
  ["about", "about 111 Network"],
  ["version", "version and license"],
  ["ascii", "the 111 logo"],
  ["clear", "clear the screen"],
]

/** Seed of the `whoami` sample label (fixed, so server and client agree). */
export const WHOAMI_SEED = "111-terminal-whoami"

/** The policy lines, in the terminal's `Label:  value` style. */
export const POLICY_LINES = [
  "Rate limits:    none",
  "Forced expiry:  none",
  "Content policy: none",
  "Pruning:        by capacity only",
] as const

/** Kept byte-for-byte from the old terminal's license line (W6). */
export const LICENSE_LINE = "License:    Open Source"

/** Where the second column starts (the hang, in ch) in `help`, `layers`, `devices` and `policy`. */
export const HELP_HANG = 14
export const LAYERS_HANG = 5
export const DEVICES_HANG = 18
export const POLICY_HANG = 16

// ---- helpers ----------------------------------------------------------------

const RANGE = "Layers run 0 to 9."

function out(text: string): OutputLine {
  return { text }
}

function bright(text: string): OutputLine {
  return { text, tone: "bright" }
}

function link(text: string, href: string, label?: string): OutputLine {
  return label ? { text, href, label } : { text, href }
}

/** A two-column row: wrapped text continues under column `hang`. */
function row(text: string, hang: number): OutputLine {
  return { text, hang }
}

/** A `label: value` line whose wrapped value stays under the value. */
function field(label: string, value: string): OutputLine {
  return row(`${label}: ${value}`, label.length + 2)
}

function layerLink(n: LayerNumber): OutputLine {
  const { id, title } = getLayer(n)
  return link(`-> #${id}`, `#${id}`, `Go to Layer ${n}: ${title}`)
}

/** Shorten echoed visitor text so one stray paste cannot flood a line. */
function clip(text: string, max = 32): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function result(lines: readonly OutputLine[], state: InterpreterState, extra: Partial<CommandResult> = {}): CommandResult {
  return { lines, state, typed: true, ...extra }
}

function usageError(state: InterpreterState, message: string): CommandResult {
  return result([out(message), out(HELP_HINT)], state)
}

/** "3", "03", "l3", "layer-3" or "#layer-3" → 3; anything else (or out of range) → null. */
export function parseLayerArg(raw: string): LayerNumber | null {
  const match = /^(?:#?layer-?|l)?(\d{1,2})$/i.exec(raw.trim())
  if (!match) return null
  const n = Number(match[1])
  return isLayerNumber(n) ? n : null
}

/** A handler for a command that takes no arguments. */
function noArgs(name: CommandName, run: (state: InterpreterState, ctx: Ctx) => CommandResult): Handler {
  return (args, state, ctx) => (args.length > 0 ? usageError(state, `${name}: takes no arguments`) : run(state, ctx))
}

/** Parse the single <n> of `layer` / `goto`, or return the usage error. */
function withLayerArg(name: string, run: (n: LayerNumber, state: InterpreterState) => CommandResult): Handler {
  return (args, state) => {
    if (args.length !== 1) return usageError(state, `usage: ${name} <n>   (n is 0 to 9)`)
    const n = parseLayerArg(args[0])
    if (n === null) return usageError(state, `${name}: no layer "${clip(args[0], 12)}". ${RANGE}`)
    return run(n, state)
  }
}

// ---- install ------------------------------------------------------------------

const INSTALL_TITLE: Readonly<Record<InstallTarget, string>> = {
  host: "Install this machine:",
  phone: "Set up an attached phone, over USB-C:",
}

function installLines(target: InstallTarget, ctx: Ctx): OutputLine[] {
  const lines = [out(INSTALL_TITLE[target]), bright(INSTALL_COMMANDS[target]), out(INSTALL_NOTES.user)]
  if (!ctx.installLive) lines.push(out(INSTALL_NOTES.prerelease))
  lines.push(link(`copy it from the install box -> #${ANCHORS.install}`, `#${ANCHORS.install}`, "copy it from the install box"))
  return lines
}

// ---- heal ---------------------------------------------------------------------

/** The word a waiting station takes: `heal approve` (a person) or `heal next` (the maintainers). */
function verbFor(gate: HealGate): "approve" | "next" {
  return gate.kind === "upstream" ? "next" : "approve"
}

function waitingLines(gate: HealGate): OutputLine[] {
  const who = gate.kind === "upstream" ? "waiting for people upstream" : "waiting for a person"
  const hint =
    gate.kind === "upstream"
      ? `nothing moves on its own: type "heal next" to play the maintainers' review`
      : `nothing moves on its own: type "heal approve" (${gate.action ?? "APPROVE"})`
  return [{ text: `${gate.label} · ${who}`, mark: "hollow", tone: "bright" }, row(`  ${gate.note}`, 2), out(hint)]
}

function passedLine(gate: HealGate): OutputLine {
  const how = gate.kind === "upstream" ? "reviewed upstream" : gate.kind === "human" ? "approved by a person" : gate.note
  return { text: `${gate.label} · ${how}`, mark: "filled" }
}

/** Fill machine stations from `from` until one waits for a visitor (or the rail ends). */
function runFrom(from: number): { lines: OutputLine[]; at: number | null } {
  const lines: OutputLine[] = []
  let i = from
  while (i < HEAL_GATES.length && !waitsForVisitor(i)) {
    lines.push(passedLine(HEAL_GATES[i]))
    i++
  }
  if (i >= HEAL_GATES.length) {
    lines.push(bright("done: the fix runs here and on node B. People passed every gate that needs them."))
    return { lines, at: null }
  }
  lines.push(...waitingLines(HEAL_GATES[i]))
  return { lines, at: i }
}

function healStart(ctx: Ctx): CommandResult {
  const device = deviceById(ctx.device)
  if (layerSupport(ctx.device, 9) === "none") {
    return result(
      [
        bright(`Following: ${device.label}`),
        out(`A ${device.label} runs no local agent, so it does not repair itself.`),
        out("Pick another device in layer 1:"),
        layerLink(1),
      ],
      { heal: null },
    )
  }
  const build = layerSupport(ctx.device, 3) === "runs" ? "built a fix on this node" : "asked a nearby hub to build a fix"
  const walk = runFrom(0)
  return result(
    [
      bright(`Repair simulation · following: ${device.label}`),
      field("health", `Layer 5 · ${getLayer(5).title} stopped answering`),
      field("agent", "diagnosed the problem"),
      field("agent", build),
      field("sandbox", "applied in a sandbox · failure replayed: gone · other layers untouched"),
      field("gates", HEAL_RAIL_LINE),
      ...walk.lines,
    ],
    { heal: walk.at },
  )
}

function healStep(verb: "approve" | "next", state: InterpreterState): CommandResult {
  if (state.heal === null) return result([out('heal: nothing is waiting. Type "heal" to start a repair.')], state)
  const gate = HEAL_GATES[state.heal]
  const expected = verbFor(gate)
  if (verb !== expected) {
    const why =
      expected === "approve"
        ? `${gate.label} waits for a person's approval; "next" cannot skip it. Type "heal approve".`
        : `${gate.label} is the maintainers' call, not an approval. Type "heal next".`
    return result([out(`heal: ${why}`)], state)
  }
  const walk = runFrom(state.heal + 1)
  return result([passedLine(gate), ...walk.lines], { heal: walk.at })
}

const heal: Handler = (args, state, ctx) => {
  if (args.length === 0) return healStart(ctx)
  if (args.length === 1 && (args[0] === "approve" || args[0] === "next")) return healStep(args[0], state)
  return usageError(state, "usage: heal · heal approve · heal next")
}

// ---- the commands -------------------------------------------------------------

const HANDLERS: Readonly<Record<CommandName, Handler>> = {
  help: noArgs("help", (state) =>
    result(
      [
        bright("Available commands:"),
        ...HELP_ROWS.map(([usage, summary]) => row(`  ${usage.padEnd(HELP_HANG - 3)} ${summary}`, HELP_HANG)),
        out("↑ ↓ recall earlier commands"),
      ],
      state,
    ),
  ),

  layers: noArgs("layers", (state) =>
    result(
      [
        ...LAYERS.map((layer) => row(`  ${layer.n}  ${layer.title} · ${layer.subtitle}`, LAYERS_HANG)),
        out('Type "layer <n>" for a summary, "goto <n>" to jump there.'),
      ],
      state,
    ),
  ),

  layer: withLayerArg("layer", (n, state) => {
    const layer = getLayer(n)
    return result([bright(`Layer ${n} · ${layer.title}`), out(layer.subtitle), out(layer.description), layerLink(n)], state)
  }),

  goto: withLayerArg("goto", (n, state) =>
    result([out(`jumping to Layer ${n} · ${getLayer(n).title}`), layerLink(n)], state, {
      effect: { kind: "scroll", layer: n },
      typed: false,
    }),
  ),

  devices: noArgs("devices", (state, ctx) => {
    const device = deviceById(ctx.device)
    return result(
      [
        bright(`Following: ${device.label}`),
        out(device.blurb),
        ...LAYERS.map((layer) =>
          row(
            `  ${layer.n} ${layer.navLabel.padEnd(DEVICES_HANG - 4)}${SUPPORT_LABELS[device.support[layer.n]]}`,
            DEVICES_HANG,
          ),
        ),
        field("All devices", DEVICES.map((d) => d.label).join(" · ")),
        link("change it in layer 1 -> #layer-1", `#${getLayer(1).id}`, `change it in layer 1: ${getLayer(1).title}`),
      ],
      state,
    )
  }),

  install: noArgs("install", (state, ctx) => result(installLines("host", ctx), state)),

  phone: noArgs("phone", (state, ctx) => result(installLines("phone", ctx), state)),

  // `sudo <anything>` gets the same answer.
  sudo: (_args, state) =>
    result(
      [bright(INSTALL_NOTES.sudo), out("Run the install as your normal user; it asks for a password itself when it needs one.")],
      state,
    ),

  whoami: noArgs("whoami", (state) =>
    result([bright(groupedLabel(WHOAMI_SEED)), out("a sample label, display-only: a label is never proof of identity")], state),
  ),

  heal,

  policy: noArgs("policy", (state) => result(POLICY_LINES.map((text) => row(text, POLICY_HANG)), state)),

  demo: noArgs("demo", (state, ctx) =>
    ctx.demoReady
      ? result(
          [
            out(`The interactive dashboard demo, with sample data: ${DEMO_PATH}`),
            link("open the demo ->", DEMO_PATH, "open the demo"),
          ],
          state,
        )
      : result([out("The dashboard demo is coming to this page.")], state),
  ),

  uninstall: noArgs("uninstall", (state) =>
    result(
      [
        out("On a computer, the install leaves its own uninstaller behind."),
        out("Running it removes everything the install added to that machine."),
        out("A phone is taken back down from the computer that set it up."),
        out("This demo terminal installs and removes nothing."),
      ],
      state,
    ),
  ),

  about: noArgs("about", (state) =>
    result(
      [
        bright(SITE_NAME),
        out(SITE_TAGLINE),
        out(SITE_DESCRIPTION),
        out('Ten layers, 0 to 9: type "layers".'),
        link(`source: ${GITHUB_URL}`, GITHUB_URL),
      ],
      state,
    ),
  ),

  version: noArgs("version", (state) => result([bright(SITE_NAME), out(`Version:    ${SITE_VERSION}`), out(LICENSE_LINE)], state)),

  ascii: noArgs("ascii", (state) =>
    result([out(""), ...ASCII_LOGO.split("\n").map((text): OutputLine => ({ text, tone: "bright", art: true })), out("")], state, {
      announce: "The 111 logo, drawn in block characters.",
    }),
  ),

  clear: noArgs("clear", (state) => result([], state, { effect: { kind: "clear" }, typed: false })),
}

/** The command a typed name runs (aliases resolved, case-insensitive), or null. */
export function resolveCommand(name: string): CommandName | null {
  const key = name.toLowerCase()
  if ((COMMAND_NAMES as readonly string[]).includes(key)) return key as CommandName
  return Object.hasOwn(COMMAND_ALIASES, key) ? COMMAND_ALIASES[key] : null
}

/**
 * Run one line of input. Blank input prints nothing; an unknown command prints
 * "command not found". `ctx.device` should be read in the event handler
 * (getCurrentDevice()), never during render.
 */
export function runCommand(input: string, state: InterpreterState, context: TerminalContext): CommandResult {
  const words = input.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { lines: [], state, typed: false }
  const [name, ...args] = words
  const command = resolveCommand(name)
  if (command === null) return result([out(`command not found: ${clip(name)}`), out(HELP_HINT)], state)
  const ctx: Ctx = {
    device: context.device,
    demoReady: context.demoReady ?? DEMO_READY,
    installLive: context.installLive ?? INSTALL_LIVE,
  }
  return HANDLERS[command](
    args.map((arg) => arg.toLowerCase()),
    state,
    ctx,
  )
}
