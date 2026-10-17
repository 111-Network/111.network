import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Terminal } from "@/components/frame/terminal"
import {
  INITIAL_INTERPRETER_STATE,
  WELCOME_LINE,
  runCommand,
  type OutputLine,
  type TerminalContext,
} from "@/components/frame/terminal-commands"
import { TerminalLine } from "@/components/frame/terminal-console"
import { GITHUB_URL } from "@/lib/site"

// Server render of the finale terminal (what the prerendered HTML holds).

describe("Terminal server render", () => {
  const html = renderToString(createElement(Terminal))

  it("renders the #terminal anchor with the nav scroll margin", () => {
    expect(html).toMatch(/<section[^>]*id="terminal"[^>]*class="[^"]*scroll-mt-nav/)
    expect(html).toContain('aria-labelledby="terminal-title"')
    expect(html).toContain('id="terminal-title"')
  })

  it("is a labelled region, never an application", () => {
    expect(html).toMatch(/role="region"[^>]*aria-label="111 Network demo terminal"/)
    expect(html).not.toContain('role="application"')
  })

  it("prints the welcome line whole, in the HTML", () => {
    expect(html).toContain(WELCOME_LINE)
  })

  it("has a labelled input that is not focused on load", () => {
    const id = /<label for="([^"]+)"[^>]*>Command<\/label>/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`id="${id}"`)
    expect(html).not.toMatch(/autofocus/i)
  })

  it("has one polite live region, empty until a command runs (one keyed text node inside)", () => {
    expect(html.match(/aria-live="polite"/g)).toHaveLength(1)
    expect(html).toMatch(/<p role="status" aria-live="polite" aria-atomic="true" class="sr-only"><span><\/span><\/p>/)
  })

  it("draws the input's focus ring on the visible window (the input itself is invisible)", () => {
    const region = /<div[^>]*role="region"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? ""
    expect(region).toContain("has-[input:focus-visible]:ring-2")
    expect(region).toContain("has-[input:focus-visible]:ring-offset-2")
    const input = /<input[^>]*class="([^"]*)"/.exec(html)?.[1] ?? ""
    expect(input).toContain("opacity-0")
    expect(input).not.toContain("focus-visible:ring")
  })

  it("prints terminal output at text-xs at every width (legacy look)", () => {
    expect(html).toMatch(/class="[^"]*\btext-xs\b[^"]*leading-relaxed/)
    expect(html).not.toContain("text-[11px]")
  })

  it("does not blink the cursor before the visitor focuses the input", () => {
    expect(html).not.toContain("animate-blink")
  })
})

describe("TerminalLine server render", () => {
  const render = (line: OutputLine) => renderToString(createElement(TerminalLine, { line }))
  const first = (input: string, ctx: Partial<TerminalContext> = {}) =>
    runCommand(input, INITIAL_INTERPRETER_STATE, { device: "laptop", demoReady: false, installLive: false, ...ctx }).lines

  it("names a layer link after its layer and keeps the visible arrow text", () => {
    const html = render(first("layer 3").at(-1)!)
    expect(html).toMatch(/<a href="#layer-3" aria-label="Go to Layer 3: [^"]+"/)
    expect(html).toContain("-&gt; #layer-3")
  })

  it("tells screen readers the source link opens a new tab", () => {
    const html = render(first("about").find((line) => line.href === GITHUB_URL)!)
    expect(html).toContain('target="_blank"')
    expect(html).toMatch(/<span class="sr-only"> \(opens in a new tab\)<\/span>/)
  })

  it("gives two-column rows a hanging indent in ch", () => {
    const html = render(first("help").find((line) => line.hang)!)
    expect(html).toContain("padding-left:14ch")
    expect(html).toContain("text-indent:-14ch")
  })

  it("sets the logo in tight leading so its strokes join", () => {
    const html = render(first("ascii").find((line) => line.art)!)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toMatch(/class="[^"]*leading-\[12px\]/)
  })

  it("draws heal marks as CSS squares in their own column", () => {
    const html = render(first("heal").find((line) => line.mark === "hollow")!)
    expect(html).toMatch(/<span class="h-2 w-2 border border-foreground"><\/span>/)
    expect(html).toContain("shrink-0")
  })
})
