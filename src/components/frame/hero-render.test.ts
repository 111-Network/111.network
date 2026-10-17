import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Hero } from "@/components/frame/hero"
import { InstallTerminal } from "@/components/frame/install-terminal"
import {
  ANCHORS,
  GITHUB_URL,
  INSTALL_COMMANDS,
  INSTALL_LIVE,
  INSTALL_NOTES,
  INSTALL_READ_FIRST_URL,
  INSTALL_RUN,
  SITE_DESCRIPTION,
  SITE_VERSION,
} from "@/lib/site"

// Server render of the hero and the install terminal (what the prerendered
// HTML holds), checked against plan §3 and the P1 brief.

/** The escaping renderToString applies to text and attribute values. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;")

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1

describe("Hero server render", () => {
  const html = renderToString(createElement(Hero))

  it("has exactly one #install, and it carries the nav scroll margin", () => {
    expect(count(html, `id="${ANCHORS.install}"`)).toBe(1)
    expect(html).toMatch(new RegExp(`<div[^>]*id="${ANCHORS.install}"[^>]*class="[^"]*scroll-mt-nav`))
  })

  it("shows SITE_VERSION once, in the inverting badge directly above the title", () => {
    expect(count(html, esc(SITE_VERSION))).toBe(1)
    const badge = html.indexOf(esc(SITE_VERSION))
    const title = html.indexOf('id="hero-title"')
    expect(badge).toBeGreaterThan(-1)
    expect(badge).toBeLessThan(title)
    expect(html).toMatch(new RegExp(`<p[^>]*class="[^"]*animate-invert[^"]*"[^>]*>${esc(SITE_VERSION)}</p>`))
  })

  it("keeps the title and prints the §3.1 subtitle", () => {
    expect(html).toContain("Free, Secure")
    expect(html).toContain("Communication for Everyone")
    expect(html).toContain(esc(SITE_DESCRIPTION))
  })

  it("links the CTA to #layer-0 with a real anchor, and GitHub to the org", () => {
    expect(html).toMatch(/<a[^>]*href="#layer-0"[^>]*>Explore the layers/)
    expect(html).toMatch(new RegExp(`<a[^>]*href="${esc(GITHUB_URL)}"[^>]*>GitHub</a>`))
  })

  it("renders the field empty (no random letters in the HTML) and the scanline paused", () => {
    expect(html).toMatch(/<pre[^>]*><\/pre>/)
    expect(html).toMatch(/class="animate-scanline[^"]*"[^>]*style="animation-play-state:paused"/)
  })

  it("has a static scroll hint, no bounce", () => {
    expect(html).toContain("scroll · start at layer 0")
    expect(html).not.toContain("animate-bounce")
  })
})

describe("InstallTerminal server render", () => {
  const html = renderToString(createElement(InstallTerminal))

  it("has no id unless one is passed (only the hero's box is #install)", () => {
    expect(html).not.toContain(`id="${ANCHORS.install}"`)
  })

  it("never prints the version string", () => {
    expect(html).not.toContain(esc(SITE_VERSION))
    expect(html).not.toMatch(/V\.0\.0\./)
  })

  it("shows the exact host command as the copy row, wrapping on narrow screens", () => {
    expect(html).toMatch(
      new RegExp(`<code[^>]*class="[^"]*whitespace-pre-wrap break-all[^"]*"[^>]*>${esc(INSTALL_COMMANDS.host).replace(/[|.]/g, "\\$&")}</code>`),
    )
    expect(html).toContain("install ~")
  })

  it("has the two tabs in plain words, THIS MACHINE selected; no HEAL tab and no OS names", () => {
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*value="host"[^>]*>THIS MACHINE<\/button>/)
    expect(html).toMatch(/role="radio" aria-checked="false"[^>]*value="phone"[^>]*>ATTACHED PHONE<\/button>/)
    expect(html.indexOf("THIS MACHINE")).toBeLessThan(html.indexOf("ATTACHED PHONE"))
    expect(html).not.toMatch(/\bHEAL\b/)
    expect(html).not.toMatch(/\b(macOS|Linux|Windows|Android|iOS|Ubuntu|Debian)\b/)
  })

  it("prints the prerelease line exactly while the installer is not live", () => {
    expect(html.includes(esc(INSTALL_NOTES.prerelease))).toBe(!INSTALL_LIVE)
  })

  it("prints the user note and the tags, with READ IT FIRST linking to the script source", () => {
    expect(html).toContain(esc(INSTALL_NOTES.user))
    for (const tag of INSTALL_NOTES.tags) expect(html).toContain(tag)
    expect(html).toMatch(new RegExp(`<a[^>]*href="${esc(INSTALL_READ_FIRST_URL)}"[^>]*>${esc(INSTALL_NOTES.readFirst)}</a>`))
  })

  it("gives screen readers the whole run at once; the typed copy is visual only and not typed yet", () => {
    for (const line of INSTALL_RUN.host) expect(html).toContain(`<li>${esc(line.text)}`)
    expect(html).not.toContain("animate-blink")
  })

  it("has one polite live line, empty until a copy", () => {
    expect(html.match(/aria-live="polite"/g)).toHaveLength(1)
    expect(html).toMatch(/<p role="status" aria-live="polite" aria-atomic="true" class="sr-only"><\/p>/)
  })
})
