import { describe, expect, it } from "vitest"
import { HELP_HINT, WELCOME_LINE, type TerminalContext } from "@/components/frame/terminal-commands"
import {
  MAX_ENTRIES,
  MAX_HISTORY,
  PARITY_MARK,
  announcementFor,
  createSession,
  editInput,
  historyNext,
  historyPrev,
  submitInput,
  type TerminalSession,
} from "@/components/frame/terminal-session"

const CTX: TerminalContext = { device: "laptop", demoReady: false, installLive: false }

function type(session: TerminalSession, text: string): TerminalSession {
  return editInput(session, text)
}

function enter(session: TerminalSession, text: string, ctx: TerminalContext = CTX) {
  return submitInput(type(session, text), ctx)
}

function runAll(...commands: string[]): TerminalSession {
  return commands.reduce((s, command) => enter(s, command).session, createSession())
}

describe("createSession", () => {
  it("starts with the welcome line only, printed whole", () => {
    const s = createSession()
    expect(s.entries).toEqual([{ id: 0, command: null, lines: [{ text: WELCOME_LINE }], typed: false }])
    expect(s.input).toBe("")
    expect(s.history).toEqual([])
    expect(s.announcement).toBe("")
  })

  it("is deterministic (server and client agree)", () => {
    expect(createSession()).toEqual(createSession())
  })
})

describe("submitInput", () => {
  it("echoes the command with its output, clears the input and records history", () => {
    const { session, scrollTo } = enter(createSession(), "  version  ")
    expect(scrollTo).toBeNull()
    expect(session.input).toBe("")
    expect(session.history).toEqual(["version"])
    const entry = session.entries.at(-1)!
    expect(entry.command).toBe("version")
    expect(entry.typed).toBe(true)
    expect(entry.lines.map((line) => line.text)).toContain("License:    Open Source")
  })

  it("gives every entry a fresh id", () => {
    const s = runAll("help", "help", "layers")
    expect(new Set(s.entries.map((entry) => entry.id)).size).toBe(s.entries.length)
  })

  it("announces the whole output in the live region, links by their label", () => {
    const { session } = enter(createSession(), "layer 2")
    expect(session.announcement).toContain("Identity.")
    expect(session.announcement).toContain("Go to Layer 2: Identity.")
    expect(session.announcement).not.toContain("->")
    expect(session.announcement).not.toContain("#layer-2")
  })

  it("alternates a non-collapsing NBSP so a repeated output still changes the rendered text", () => {
    for (const command of ["whoami", "help", "clear", "heal approve", "layer 12"]) {
      const once = enter(createSession(), command).session
      const twice = enter(once, command).session
      const thrice = enter(twice, command).session
      // Ids 1 and 3 carry the mark, id 2 does not: back-to-back texts always differ.
      expect(once.announcement.endsWith(PARITY_MARK)).toBe(true)
      expect(twice.announcement.endsWith(PARITY_MARK)).toBe(false)
      expect(thrice.announcement).toBe(once.announcement)
      expect(twice.announcement).not.toBe(once.announcement)
      expect(once.announcement.slice(0, -1)).toBe(twice.announcement)
      // An ASCII space would collapse away in the rendered live region; the mark must not be one.
      expect(PARITY_MARK).toBe(" ")
      expect(/ $/.test(once.announcement) || / $/.test(twice.announcement)).toBe(false)
    }
  })

  it("moves the live-region key (nextId) on every submit, blank ones included", () => {
    const s0 = createSession()
    const s1 = enter(s0, "help").session
    const s2 = enter(s1, "help").session
    const s3 = enter(s2, "  ").session
    expect(new Set([s0.nextId, s1.nextId, s2.nextId, s3.nextId]).size).toBe(4)
  })

  it("a blank Enter echoes an empty prompt, adds no history and announces nothing", () => {
    const { session } = enter(createSession(), "   ")
    expect(session.history).toEqual([])
    expect(session.entries.at(-1)).toMatchObject({ command: "", lines: [], typed: false })
    expect(session.announcement).toBe("")
  })

  it("does not record back-to-back repeats", () => {
    expect(runAll("help", "help", "layers", "help").history).toEqual(["help", "layers", "help"])
  })

  it("keeps unknown commands in history and prints the hint", () => {
    const s = runAll("nope")
    expect(s.history).toEqual(["nope"])
    expect(s.entries.at(-1)!.lines.map((line) => line.text)).toEqual(["command not found: nope", HELP_HINT])
  })

  it("clear empties the screen and announces it", () => {
    const s = runAll("help", "layers", "clear")
    expect(s.entries).toEqual([])
    expect(s.announcement.trim()).toBe("Screen cleared.")
    expect(s.history).toEqual(["help", "layers", "clear"])
  })

  it("goto returns the layer to scroll to and prints whole", () => {
    const { session, scrollTo } = enter(createSession(), "open 4")
    expect(scrollTo).toBe(4)
    expect(session.entries.at(-1)!.typed).toBe(false)
  })

  it("reads the device from the context of each submit", () => {
    const phone = enter(createSession(), "devices", { ...CTX, device: "old-phone" }).session
    expect(phone.entries.at(-1)!.lines[0].text).toBe("Following: old phone")
    const relay = enter(phone, "devices", { ...CTX, device: "radio-relay" }).session
    expect(relay.entries.at(-1)!.lines[0].text).toBe("Following: radio relay")
  })

  it("carries the heal walk between submits", () => {
    const started = runAll("heal")
    expect(started.interp.heal).not.toBeNull()
    const approved = enter(started, "heal approve").session
    expect(approved.interp.heal).not.toBe(started.interp.heal)
  })

  it("passes the ascii description to screen readers", () => {
    const { session } = enter(createSession(), "ascii")
    expect(session.entries.at(-1)!.srText).toMatch(/logo/)
    expect(session.announcement).toMatch(/^The 111 logo/)
    expect(session.announcement).not.toMatch(/[─-▟]/)
  })

  it("caps history and entries", () => {
    let s = createSession()
    for (let i = 0; i < MAX_ENTRIES + 20; i++) s = enter(s, `layer ${i % 10}`).session
    expect(s.entries.length).toBe(MAX_ENTRIES)
    expect(s.history.length).toBe(MAX_HISTORY)
  })
})

describe("history recall", () => {
  const base = () => type(runAll("help", "layers", "whoami"), "draft")

  it("ArrowUp walks back from the newest and keeps the unsent line", () => {
    let s = historyPrev(base())
    expect(s.input).toBe("whoami")
    expect(s.draft).toBe("draft")
    s = historyPrev(s)
    expect(s.input).toBe("layers")
    s = historyPrev(s)
    expect(s.input).toBe("help")
    expect(historyPrev(s)).toBe(s)
  })

  it("ArrowDown walks forward and then restores the unsent line", () => {
    let s = historyPrev(historyPrev(base()))
    s = historyNext(s)
    expect(s.input).toBe("whoami")
    s = historyNext(s)
    expect(s.input).toBe("draft")
    expect(s.cursor).toBeNull()
    expect(historyNext(s)).toBe(s)
  })

  it("does nothing with an empty history", () => {
    const s = type(createSession(), "abc")
    expect(historyPrev(s)).toBe(s)
    expect(historyNext(s)).toBe(s)
  })

  it("editing a recalled line makes it a fresh line", () => {
    const recalled = historyPrev(base())
    const edited = editInput(recalled, "whoami again")
    expect(edited.cursor).toBeNull()
    expect(historyPrev(edited).input).toBe("whoami")
    expect(historyPrev(edited).draft).toBe("whoami again")
  })

  it("submitting resets the recall position", () => {
    const { session } = submitInput(historyPrev(base()), CTX)
    expect(session.cursor).toBeNull()
    expect(session.draft).toBe("")
    expect(session.input).toBe("")
  })
})

describe("announcementFor", () => {
  it("joins lines as sentences, skips art and blanks, drops link arrows", () => {
    expect(
      announcementFor([
        { text: "Title" },
        { text: "" },
        { text: "  indented row" },
        { text: "art", art: true },
        { text: "-> #layer-1", href: "#layer-1" },
        { text: "open the demo ->", href: "/demo" },
        { text: "change it -> #layer-1", href: "#layer-1" },
        { text: "Already done." },
      ]),
    ).toBe("Title. indented row. #layer-1. open the demo. change it #layer-1. Already done.")
  })

  it("puts a description first", () => {
    expect(announcementFor([{ text: "x", art: true }], "A logo.")).toBe("A logo.")
  })

  it("reads a labelled link by its label", () => {
    expect(announcementFor([{ text: "-> #layer-3", href: "#layer-3", label: "Go to Layer 3: Local Intelligence" }])).toBe(
      "Go to Layer 3: Local Intelligence.",
    )
  })
})
