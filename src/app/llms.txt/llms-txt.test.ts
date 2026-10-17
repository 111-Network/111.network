import { describe, expect, it } from "vitest"
import { LAYERS } from "@/lib/layers"
import {
  DEMO_PATH,
  DEMO_READY,
  GITHUB_URL,
  INSTALL_COMMANDS,
  INSTALL_LIVE,
  INSTALL_NOTES,
  INSTALL_READ_FIRST_URL,
  INSTALL_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SITE_VERSION,
} from "@/lib/site"
import { renderLlmsTxt } from "./llms-txt"
import { GET, dynamic } from "./route"

describe("/llms.txt route", () => {
  it("is a force-static plain-text route", async () => {
    expect(dynamic).toBe("force-static")
    const res = GET()
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    expect(await res.text()).toBe(renderLlmsTxt())
  })
})

describe("renderLlmsTxt", () => {
  const text = renderLlmsTxt()

  it("prints the name, description and SITE_VERSION (W9)", () => {
    expect(text.startsWith(`# ${SITE_NAME}\n`)).toBe(true)
    expect(text).toContain(SITE_DESCRIPTION)
    expect(text).toContain(SITE_VERSION)
  })

  it("prints the ten layers, one line each, in order", () => {
    const layerLines = text.split("\n").filter((line) => /^- \[0\d /.test(line))
    expect(layerLines).toHaveLength(10)
    LAYERS.forEach((layer, i) => {
      expect(layerLines[i]).toContain(`${layer.ghost} ${layer.title}`)
      expect(layerLines[i]).toContain(`${SITE_URL}/#${layer.id}`)
      expect(layerLines[i]).toContain(layer.description)
    })
  })

  it("prints the install commands and the GitHub org", () => {
    expect(text).toContain(INSTALL_COMMANDS.host)
    expect(text).toContain(INSTALL_COMMANDS.phone)
    expect(text).toContain(INSTALL_NOTES.user)
    expect(text).toContain(`(${GITHUB_URL})`)
  })

  it("follows the live flags by default", () => {
    expect(text.includes(INSTALL_NOTES.prerelease)).toBe(!INSTALL_LIVE)
    expect(text.includes(`${SITE_URL}${DEMO_PATH}`)).toBe(DEMO_READY)
    expect(text).toContain(`Read it first: ${INSTALL_READ_FIRST_URL}`)
  })

  it("adds the pre-release note only while the installer is not live", () => {
    expect(renderLlmsTxt({ installLive: false })).toContain(INSTALL_NOTES.prerelease)
    expect(renderLlmsTxt({ installLive: true, readFirstUrl: INSTALL_URL })).not.toContain(INSTALL_NOTES.prerelease)
  })

  it("adds the /demo line only once the demo is ready", () => {
    expect(renderLlmsTxt({ demoReady: false })).not.toContain(`${SITE_URL}${DEMO_PATH}`)
    expect(renderLlmsTxt({ demoReady: true })).toContain(`(${SITE_URL}${DEMO_PATH})`)
  })

  it("ends with exactly one newline", () => {
    expect(text.endsWith("\n")).toBe(true)
    expect(text.endsWith("\n\n")).toBe(false)
  })
})
