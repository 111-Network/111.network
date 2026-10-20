// Server-rendered checks of the /demo primitives: what they put in the HTML is what a keyboard or
// screen-reader user gets (no DOM needed). Mirrors os/4-interface/ui/test/components.test.ts.
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AttentionBadge } from "./attention-badge"
import { Badge } from "./badge"
import { Button } from "./button"
import { ButtonLink } from "./button-link"
import { CopyButton } from "./copy-button"
import { DemoButton } from "./demo-button"
import { DemoNote } from "./demo-note"
import { DemoTag } from "./demo-tag"
import { DiffView } from "./diff-view"
import { Disclosure } from "./disclosure"
import { Empty } from "./empty"
import { MiniTerminal } from "./mini-terminal"
import { Panel } from "./panel"
import { SectionHeader } from "./section-header"
import { Segmented } from "./segmented"
import { Sparkline } from "./sparkline"
import { SpecTable } from "./spec-table"
import { StatusDot } from "./status-dot"
import { TerminalChrome } from "./terminal-chrome"
import { Toggle, type ToggleProps } from "./toggle"

const html = (el: ReactElement) => renderToStaticMarkup(el)
const noop = () => undefined
const DISABLED_ATTR = /\sdisabled(=|\s|>)/
/** Toggle requires children in its props type, so build the props first (createElement's third argument cannot satisfy it). */
const toggle = (props: ToggleProps) => createElement(Toggle, props)

describe("StatusDot", () => {
  it("prints its label next to the square", () => {
    const out = html(createElement(StatusDot, { state: "live" }))
    expect(out).toContain('class="inline-block h-2 w-2 shrink-0 bg-status-live"')
    expect(out).toContain(">LIVE</span>")
    expect(out).not.toContain("sr-only")
  })

  it("keeps the label for screen readers when the visible one is hidden", () => {
    const out = html(createElement(StatusDot, { state: "unset", label: false, name: "Long-range radio" }))
    expect(out).toContain('<span class="sr-only">Long-range radio: NOT SET</span>')
  })

  it("blinks only while starting and draws unknown hollow", () => {
    expect(html(createElement(StatusDot, { state: "starting" }))).toContain("animate-blink")
    expect(html(createElement(StatusDot, { state: "live" }))).not.toContain("animate-blink")
    expect(html(createElement(StatusDot, { state: "unknown" }))).toContain("border border-status-unset")
  })
})

describe("Button keeps focus while it works", () => {
  it("loading is aria-disabled, not disabled, and shows the block cursor", () => {
    const out = html(createElement(Button, { loading: true }, "Check now"))
    expect(out).toContain('aria-disabled="true"')
    expect(out).toContain('aria-busy="true"')
    expect(out).not.toMatch(DISABLED_ATTR)
    expect(out).toContain("animate-blink")
    expect(out).toContain('<span class="sr-only">working</span>')
  })

  it("a plain disabled button is still disabled", () => {
    expect(html(createElement(Button, { disabled: true }, "Go"))).toMatch(DISABLED_ATTR)
  })

  it("aria-disabled passed in is honoured without the disabled attribute", () => {
    const out = html(createElement(Button, { "aria-disabled": true }, "send"))
    expect(out).toContain('aria-disabled="true"')
    expect(out).not.toMatch(DISABLED_ATTR)
  })

  it("an idle button carries neither, and is type=button", () => {
    const out = html(createElement(Button, null, "Go"))
    expect(out).not.toContain('aria-disabled="')
    expect(out).not.toContain('aria-busy="')
    expect(out).toContain('type="button"')
  })

  it("a confirmable submit button does not submit on the first click", () => {
    expect(html(createElement(Button, { type: "submit", confirm: "Accept this change" }, "Accept"))).toContain('type="button"')
  })

  it("primary gets the trailing arrow, hidden from AT", () => {
    expect(html(createElement(Button, { variant: "primary" }, "Open"))).toMatch(/<span aria-hidden="true"[^>]*>-&gt;<\/span>/)
    expect(html(createElement(Button, null, "Open"))).not.toContain("-&gt;")
  })
})

describe("ButtonLink", () => {
  it("opens link-outs in a new tab with noopener and says so", () => {
    const out = html(createElement(ButtonLink, { href: "https://github.com/111-Network", external: true }, "GitHub"))
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain("(opens in a new tab)")
  })

  it("an in-page link is a plain anchor with the button look", () => {
    const out = html(createElement(ButtonLink, { href: "#/overview", variant: "primary" }, "Overview"))
    expect(out).toContain('href="#/overview"')
    expect(out).not.toContain("target=")
    expect(out).toContain("bg-foreground")
  })
})

describe("Toggle", () => {
  it("busy keeps it focusable but marks it disabled", () => {
    const out = html(toggle({ pressed: true, onPressedChange: noop, busy: true, children: "Share over Wi-Fi" }))
    expect(out).toContain('aria-disabled="true"')
    expect(out).toContain('aria-pressed="true"')
    expect(out).not.toMatch(DISABLED_ATTR)
  })

  it("pressed is inverted and carries the offset ring", () => {
    const out = html(toggle({ pressed: true, onPressedChange: noop, children: "on" }))
    expect(out).toContain("bg-foreground text-background")
    expect(out).toContain("focus-visible:ring-offset-2")
  })
})

describe("Segmented", () => {
  const options = [
    { value: "simple", label: "SIMPLE" },
    { value: "advanced", label: "ADVANCED" },
  ] as const

  it("is one radiogroup with a roving tab stop on the selected option", () => {
    const out = html(createElement(Segmented, { value: "advanced", onChange: noop, options, label: "Interface mode" }))
    expect(out).toContain('role="radiogroup" aria-label="Interface mode"')
    expect(out.match(/role="radio"/g)).toHaveLength(2)
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(out).toMatch(/aria-checked="true" tabindex="0"[^>]*>ADVANCED/)
    expect(out).toMatch(/aria-checked="false" tabindex="-1"[^>]*>SIMPLE/)
  })
})

describe("Panel", () => {
  it("exposes the title as a visually hidden heading when asked, nothing otherwise", () => {
    expect(html(createElement(Panel, { title: "Long-range radio", heading: 2 }, "x"))).toContain(
      '<h2 class="sr-only">Long-range radio</h2>',
    )
    expect(html(createElement(Panel, { title: "Long-range radio" }, "x"))).not.toContain("<h2")
  })

  it("renders the chrome, the element asked for and the panel shadow when elevated", () => {
    const out = html(createElement(Panel, { as: "section", title: "agent", suffix: "chat", elevated: true }, "x"))
    expect(out.startsWith("<section")).toBe(true)
    expect(out).toContain("agent ~ chat")
    expect(out).toContain("shadow-panel")
  })
})

describe("TerminalChrome", () => {
  it("draws three decorative squares and the title ~ suffix label", () => {
    const out = html(createElement(TerminalChrome, { title: "workshop laptop" }))
    expect(out.match(/aria-hidden="true"/g)).toHaveLength(3)
    expect(out).toContain("workshop laptop ~ terminal")
  })
})

describe("SpecTable", () => {
  it("is a description list that drops advanced rows in simple mode", () => {
    const rows = [
      { label: "Runs on", value: "laptop" },
      { label: "Detail", value: "deep", minMode: "advanced" as const },
    ]
    const simple = html(createElement(SpecTable, { rows, mode: "simple", title: "Facts" }))
    expect(simple).toContain("<dl")
    expect(simple).toContain("<dt")
    expect(simple).toContain("Runs on")
    expect(simple).not.toContain("Detail")
    expect(html(createElement(SpecTable, { rows }))).toContain("Detail")
  })
})

describe("Disclosure", () => {
  it("is a native details element whose marker flips in CSS", () => {
    const closed = html(createElement(Disclosure, { summary: "not available on this device (1)" }, "x"))
    expect(closed).toMatch(/^<details>/)
    expect(closed).toContain("[details[open]&gt;summary&gt;&amp;]:hidden")
    const open = html(createElement(Disclosure, { summary: "s", defaultOpen: true }, "x"))
    expect(open).toMatch(/^<details open="">/)
  })
})

describe("MiniTerminal", () => {
  it("is a labelled, quiet log region with the empty text and optional cursor", () => {
    const empty = html(createElement(MiniTerminal, { title: "agent events", lines: [], emptyText: "No events yet." }))
    expect(empty).toContain('role="log" aria-live="off" aria-label="agent events output" tabindex="0"')
    expect(empty).toContain("No events yet.")
    expect(empty).not.toContain("animate-blink")
    const live = html(createElement(MiniTerminal, { title: "t", lines: ["$ check", "ok"], live: true }))
    expect(live).toContain("animate-blink")
    expect(live).toMatch(/text-foreground">\$ check</)
    expect(live).toMatch(/text-muted-foreground">ok</)
  })
})

describe("Sparkline", () => {
  it("hides the glyphs and labels the chart in words", () => {
    const out = html(createElement(Sparkline, { values: [0, 7], label: "Disk use rising" }))
    expect(out).toContain('role="img" aria-label="Disk use rising"')
    expect(out).toContain('<span aria-hidden="true">▁█</span>')
    expect(html(createElement(Sparkline, { values: [], label: "No samples yet" }))).toContain("—")
  })

  it("draws the line variant as one labelled SVG path", () => {
    const out = html(createElement(Sparkline, { values: [0, 10], label: "Trend", variant: "line" }))
    expect(out).toMatch(/^<svg role="img" aria-label="Trend"/)
    expect(out).toContain('d="M0 19L100 1"')
    expect(out).toContain('vector-effect="non-scaling-stroke"')
  })
})

describe("DiffView", () => {
  it("keeps the +/- in the text and brightens additions only", () => {
    const out = html(createElement(DiffView, { diff: "@@ x @@\n-old\n+new\n", label: "Proposed change" }))
    expect(out).toContain('role="group" aria-label="Proposed change" tabindex="0"')
    expect(out).toContain('class="block text-foreground">+new</span>')
    expect(out).toContain('class="block text-muted-foreground">-old</span>')
  })
})

describe("Empty, SectionHeader, Badge, AttentionBadge", () => {
  it("Empty prints kicker, title, reason and action", () => {
    const out = html(createElement(Empty, { kicker: "NOT SET", title: "No radio yet", action: "act" }, "Plug one in."))
    expect(out).toContain("border-dashed")
    expect(out).toContain("NOT SET")
    expect(out).toContain("Plug one in.")
    expect(out).toContain('<div class="mt-4">act</div>')
  })

  it("SectionHeader is a pixel heading at the asked level that grows with the container", () => {
    const out = html(createElement(SectionHeader, { kicker: "overview", title: "Workshop laptop", level: 1, id: "view-title" }))
    expect(out).toMatch(/<h1 id="view-title" class="[^"]*font-pixel-line[^"]*@min-\[768px\]:text-3xl/)
  })

  it("AttentionBadge renders nothing at zero and reads in words", () => {
    expect(html(createElement(AttentionBadge, { count: 0 }))).toBe("")
    const out = html(createElement(AttentionBadge, { count: 2 }))
    expect(out).toContain('role="img" aria-label="2 items need you"')
    expect(out).toContain('<span aria-hidden="true">2</span>')
    expect(html(createElement(AttentionBadge, { count: 120 }))).toContain(">99+<")
  })

  it("Badge is a bordered tag", () => {
    expect(html(createElement(Badge, null, "LAPTOP"))).toBe(
      '<span class="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">LAPTOP</span>',
    )
  })
})

describe("CopyButton", () => {
  it("starts idle with its accessible name and an empty status line", () => {
    const out = html(createElement(CopyButton, { text: "k7m2-qx6d-4a", ariaLabel: "Copy the label" }))
    expect(out).toContain('aria-label="Copy the label"')
    expect(out).toContain(">copy</button>")
    expect(out).toContain('<span role="status" class="sr-only"></span>')
    expect(out).not.toContain("<textarea")
  })
})

describe("demo markers", () => {
  it("DemoButton puts the DEMO tag in front of the action, inside the button", () => {
    const out = html(createElement(DemoButton, { onClick: noop }, "plug in a radio board"))
    expect(out).toMatch(/^<button type="button"[^>]*><span class="[^"]*border-current[^"]*">DEMO<\/span><span>plug in a radio board<\/span><\/button>$/)
    expect(out).toContain("px-3 py-2 text-xs")
  })

  it("DemoTag and DemoNote print the plan's words", () => {
    expect(html(createElement(DemoTag))).toContain(">DEMO<")
    expect(html(createElement(DemoNote))).toContain(">demo message<")
    expect(html(createElement(DemoNote, { kind: "reply" }))).toContain(">demo reply<")
    expect(html(createElement(DemoNote, { kind: "node" }))).toContain(">demo node<")
    expect(html(createElement(DemoNote))).toContain("border-dashed")
  })
})

describe("port rules hold in the rendered markup", () => {
  const all = [
    createElement(StatusDot, { state: "live" }),
    createElement(TerminalChrome, { title: "t", end: "x" }),
    createElement(Panel, { title: "p", tint: true, elevated: true }, "x"),
    createElement(SpecTable, { rows: [{ label: "a", value: "b" }], title: "t" }),
    createElement(Badge, null, "b"),
    createElement(Button, { variant: "primary", confirm: "Sure" }, "b"),
    createElement(ButtonLink, { href: "#/", external: true }, "l"),
    createElement(Segmented, { value: "a", onChange: noop, options: [{ value: "a", label: "A" }], label: "g" }),
    toggle({ pressed: false, onPressedChange: noop, children: "t" }),
    createElement(Disclosure, { summary: "s" }, "x"),
    createElement(MiniTerminal, { title: "m", lines: ["a"], live: true }),
    createElement(Sparkline, { values: [1, 2], label: "s", variant: "line" }),
    createElement(DiffView, { diff: "+a" }),
    createElement(Empty, { title: "e" }),
    createElement(SectionHeader, { kicker: "k", title: "t" }),
    createElement(AttentionBadge, { count: 3 }),
    createElement(CopyButton, { text: "x" }),
    createElement(DemoButton, null, "d"),
    createElement(DemoNote),
  ]
  const markup = all.map(html).join("\n")
  const classTokens = [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))

  it("has zero radius and nothing positioned fixed", () => {
    expect(classTokens.some((t) => /(^|:)rounded/.test(t))).toBe(false)
    expect(classTokens.some((t) => /(^|:)fixed$/.test(t))).toBe(false)
    expect(markup).not.toMatch(/position:\s*fixed/)
  })

  it("uses container queries only: no viewport breakpoints or viewport units", () => {
    expect(classTokens.some((t) => /^(max-)?(sm|md|lg|xl|2xl):/.test(t))).toBe(false)
    expect(classTokens.some((t) => /\d(d|s|l)?v[hw]\b|(^|-)(screen)$/.test(t))).toBe(false)
  })

  it("keeps status colours on status dots only", () => {
    const owners = [...markup.matchAll(/class="([^"]*status-(?:live|unset|error)[^"]*)"/g)].map((m) => m[1])
    expect(owners.length).toBeGreaterThan(0)
    for (const c of owners) expect(c).toMatch(/\bh-2 w-2\b/)
  })
})
