import type { Locator, Page } from "@playwright/test"
import { INSTALL_COMMANDS, SITE_VERSION } from "../src/lib/site"
import { expect, nextFrame, openHome, scrollThrough, statusLine, test } from "./fixtures"

// Smoke test of the home page (plan §2–§7) on a phone (375 px) and a desktop
// (1280 px). Runs against the production build: `pnpm build && pnpm e2e`.

const W2_NAMES = ["Meshtastic", "MeshCore", "Reticulum"] as const

const section = (page: Page, n: number): Locator => page.locator(`section#layer-${n}`)
const terminal = (page: Page): Locator => page.getByRole("region", { name: "111 Network demo terminal" })
/** The terminal's scrolling output (the body that holds the prompt), without its live region. */
const output = (page: Page): Locator => terminal(page).locator("div:has(> form)")

/** Type one command into the finale terminal and press Enter. */
async function run(page: Page, command: string): Promise<void> {
  const input = terminal(page).getByRole("textbox", { name: "Command" })
  await input.fill(command)
  await input.press("Enter")
}

test.describe("page structure", () => {
  test("hero, install, every layer section and the terminal are there, in order", async ({ page }) => {
    await openHome(page)

    await expect(page.getByRole("heading", { level: 1, name: /Free, Secure/ })).toBeVisible()
    await expect(page.locator("#install")).toHaveCount(1)
    await expect(page.getByRole("group", { name: "Install", exact: true })).toBeVisible()

    for (let n = 0; n <= 9; n++) {
      await expect(section(page, n)).toHaveCount(1)
      await expect(section(page, n)).toHaveAttribute("aria-labelledby", `layer-${n}-title`)
      await expect(section(page, n).locator(`#layer-${n}-title`)).toHaveCount(1)
    }
    await expect(page.locator("section#terminal")).toHaveCount(1)

    const order = await page
      .locator("main section[id]")
      .evaluateAll((els) => els.map((el) => el.id).filter((id) => /^(layer-\d|terminal)$/.test(id)))
    expect(order).toEqual([...Array.from({ length: 10 }, (_, n) => `layer-${n}`), "terminal"])
  })

  test("no horizontal page scroll from top to bottom", async ({ page, viewport }) => {
    await openHome(page)
    const steps = await scrollThrough(page)
    expect(steps.length).toBeGreaterThan(5)
    for (const step of steps) {
      expect(step.innerWidth, `innerWidth at y=${step.y}`).toBe(viewport?.width)
      expect(step.scrollWidth, `scrollWidth at y=${step.y}: ${step.offenders.join(", ")}`).toBeLessThanOrEqual(
        step.innerWidth,
      )
    }
  })

  test("no console errors or hydration warnings on load and after scrolling to the bottom", async ({
    page,
    consoleProblems,
  }) => {
    await openHome(page)
    await page.waitForLoadState("networkidle")
    expect(consoleProblems).toEqual([])

    await scrollThrough(page)
    await expect(page.locator("footer")).toBeInViewport()
    await page.waitForLoadState("networkidle")
    await nextFrame(page)
    expect(consoleProblems).toEqual([])
  })

  test("the three W2 names appear exactly once, in the Layer 6 line", async ({ page }) => {
    await openHome(page)
    await scrollThrough(page)

    const counts = await page.evaluate((names) => {
      const parts: string[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          node.parentElement?.closest("script, style, noscript, template")
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      })
      while (walker.nextNode()) parts.push(walker.currentNode.nodeValue ?? "")
      const attrs = ["aria-label", "aria-description", "title", "alt", "placeholder", "content", "value"]
      for (const el of document.querySelectorAll("*")) {
        for (const attr of attrs) {
          const value = el.getAttribute(attr)
          if (value) parts.push(value)
        }
      }
      const all = parts.join("\n")
      return names.map((name) => all.split(name).length - 1)
    }, [...W2_NAMES])

    expect(counts).toEqual(W2_NAMES.map(() => 1))
    for (const name of W2_NAMES) await expect(section(page, 6)).toContainText(name)
  })
})

test.describe("navigation", () => {
  test("desktop rail: an anchor click lands the section and marks it current", async ({ page, isMobile }) => {
    test.skip(isMobile, "the rail shows from lg up")
    await openHome(page)

    const rail = page.getByRole("list", { name: "Layers", exact: true })
    const link = rail.getByRole("link", { name: "Layer 3: Local Intelligence" })
    await expect(rail.locator('[aria-current="location"]')).toHaveCount(0)

    await link.click()
    await expect(page).toHaveURL(/#layer-3$/)
    await expect(link).toHaveAttribute("aria-current", "location")
    await expect(rail.locator('[aria-current="location"]')).toHaveCount(1)
    await expect(page.locator("#layer-3-title")).toBeInViewport()
    // Lands just below the sticky nav (scroll-mt-nav), not under it.
    await expect
      .poll(() => section(page, 3).evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(60)
    await expect
      .poll(() => section(page, 3).evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeLessThanOrEqual(68)

    await rail.getByRole("link", { name: "Layer 8: Storage & Shared State" }).click()
    await expect(page).toHaveURL(/#layer-8$/)
    await expect(rail.getByRole("link", { name: "Layer 8: Storage & Shared State" })).toHaveAttribute(
      "aria-current",
      "location",
    )
    await expect(link).not.toHaveAttribute("aria-current", "location")
  })

  test("mobile MENU: the sheet opens, traps focus and closes on Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "MENU shows below lg")
    await openHome(page)

    // includeHidden: while the sheet is open the dialog hides the rest of the page (aria-hidden), MENU included.
    const trigger = page.getByRole("button", { name: "MENU", exact: true, includeHidden: true })
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await trigger.click()

    const sheet = page.getByRole("dialog", { name: "Menu" })
    await expect(sheet).toBeVisible()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(sheet.getByRole("link", { name: /^Layer \d/ })).toHaveCount(10)

    const focusInside = () => sheet.evaluate((el) => el.contains(document.activeElement))
    await expect.poll(focusInside).toBe(true)

    // Tab past the end and Shift+Tab past the start: focus never leaves the sheet.
    const stops = await sheet.locator("a[href], button").count()
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press("Tab")
      expect(await focusInside(), `after Tab #${i + 1}`).toBe(true)
    }
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press("Shift+Tab")
      expect(await focusInside(), `after Shift+Tab #${i + 1}`).toBe(true)
    }

    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  test("mobile MENU: a layer tile closes the sheet and lands the section", async ({ page, isMobile }) => {
    test.skip(!isMobile, "MENU shows below lg")
    await openHome(page)

    await page.getByRole("button", { name: "MENU", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "Menu" })
    await sheet.getByRole("link", { name: "Layer 5 MESSAGING" }).click()

    await expect(sheet).toBeHidden()
    await expect(page).toHaveURL(/#layer-5$/)
    await expect(page.locator("#layer-5-title")).toBeInViewport()
    await expect(section(page, 5)).toBeFocused()
  })
})

test.describe("hero install terminal", () => {
  test("COPY puts the exact command on the clipboard and flips to COPIED", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL })
    await openHome(page)

    const install = page.locator("#install")
    const copy = install.getByRole("button", { name: /the install command$/ })
    await expect(copy).toHaveText(/^COPY\b/)
    await copy.click()

    await expect(copy).toHaveText(/^COPIED\b/)
    await expect(statusLine(install, "Install command copied.")).toHaveCount(1)
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(INSTALL_COMMANDS.host)
  })

  test("ATTACHED PHONE switches the command", async ({ page }) => {
    await openHome(page)
    const install = page.locator("#install")
    await expect(install.locator("code")).toHaveText(INSTALL_COMMANDS.host)

    await install.getByRole("radio", { name: "ATTACHED PHONE" }).click()
    await expect(install.getByRole("radio", { name: "ATTACHED PHONE" })).toHaveAttribute("aria-checked", "true")
    await expect(install.locator("code")).toHaveText(INSTALL_COMMANDS.phone)
  })

  test("reduced motion prints the install run whole, without typing", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openHome(page)
    await nextFrame(page)

    // The visual run (aria-hidden): rows not typed yet are visibility:hidden.
    const run = page.locator("#install div[aria-hidden='true']").filter({ hasText: "reading hardware" })
    const host = [
      "reading hardware",
      "this laptop can run a small AI locally",
      "identity made on this device",
      "installing only what it needs",
      "node online · dashboard ready",
    ]
    // No polling: every row is already on screen the moment the page is interactive.
    for (const text of host) expect(await run.getByText(text).isVisible(), text).toBe(true)

    await page.locator("#install").getByRole("radio", { name: "ATTACHED PHONE" }).click()
    await nextFrame(page)
    const phone = [
      "plug the phone in over USB-C",
      "the installer shows each tap only you can make",
      "phone online · dashboard ready",
    ]
    for (const text of phone) expect(await run.getByText(text).isVisible(), text).toBe(true)
  })
})

test.describe("finale terminal", () => {
  test("help, layer 3 and version print their output", async ({ page }) => {
    await openHome(page)
    const out = output(page)
    await expect(out).toContainText("111 Network demo terminal. Type help.")

    await run(page, "help")
    await expect(out.getByText("Available commands:")).toBeVisible()
    await expect(out.getByText("recall earlier commands")).toBeVisible()

    await run(page, "layer 3")
    await expect(out.getByText("Layer 3 · Local Intelligence")).toBeVisible()
    await expect(out.getByRole("link", { name: "Go to Layer 3: Local Intelligence" })).toBeVisible()

    await run(page, "version")
    await expect(out.getByText(SITE_VERSION)).toBeVisible()
    // W6: the license line, verbatim (four spaces), as one visible output line.
    await expect(out.getByText(/^License:\s+Open Source$/)).toBeVisible()
    await expect
      .poll(() =>
        out.evaluate((el) => [...el.querySelectorAll("div")].some((d) => d.textContent === "License:    Open Source")),
      )
      .toBe(true)
  })
})

test.describe("follow one device", () => {
  test("?device=old-phone preselects L1 and the following lines on L3, L8 and L9", async ({ page }) => {
    await openHome(page, "/?device=old-phone")

    const chip = section(page, 1).getByRole("radiogroup", { name: "device" }).getByRole("radio", { name: "old phone" })
    await expect(chip).toHaveAttribute("aria-checked", "true")
    await expect(section(page, 1).getByText("phone setup over USB-C")).toBeVisible()

    for (const n of [3, 8, 9]) {
      const line = section(page, n).locator("p").filter({ hasText: "following:" })
      await expect(line, `layer ${n}`).toHaveText(/^following: old phone\b/)
    }

    await run(page, "devices")
    await expect(output(page).getByText("Following: old phone")).toBeVisible()
  })
})

test.describe("interactive sections: one key interaction each", () => {
  test("L0 drawers: opening DEVICES deals its cards", async ({ page }) => {
    await openHome(page)
    const tray = page.locator("#layer-0-tray")
    await expect(tray).toContainText("Drawer · PROJECTS")

    await section(page, 0).getByRole("tab", { name: "DEVICES drawer" }).click()
    await expect(section(page, 0).getByRole("tab", { name: "DEVICES drawer" })).toHaveAttribute("aria-selected", "true")
    await expect(tray).toContainText("Drawer · DEVICES")
  })

  test("L1 device chips: radio relay retypes the log and follows page-wide", async ({ page }) => {
    await openHome(page)
    const l1 = section(page, 1)
    await expect(l1.getByRole("list", { name: "Layers the laptop runs" })).toHaveCount(1)

    await l1.getByRole("radio", { name: "radio relay" }).click()
    await expect(l1.getByRole("list", { name: "Layers the radio relay runs" })).toHaveCount(1)
    // The log types only while it is on screen (below the picker on a phone): bring the line into view.
    const setup = l1.getByText("set up once from a nearby computer: unplug it and it keeps going")
    await setup.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
    await expect(setup).toBeVisible()
    await expect(page).toHaveURL(/[?&]device=radio-relay\b/)
    await expect(section(page, 8).locator("p").filter({ hasText: "following:" })).toHaveText(
      /^following: radio relay\b/,
    )
  })

  test("L2 identity bench: INSTALL then ANNOUNCE", async ({ page }) => {
    await openHome(page)
    const l2 = section(page, 2)
    await expect(l2).toContainText("Slot empty, nothing issued yet.")

    await l2.getByRole("radio", { name: "1 INSTALL" }).click()
    await expect(statusLine(l2, "Installed. The node made its own identity")).toHaveCount(1)

    await l2.getByRole("radio", { name: "2 ANNOUNCE" }).click()
    await expect(statusLine(l2, "Verdict accepted.")).toHaveCount(1)
  })

  test("L3 patch bay: the consent switch", async ({ page }) => {
    await openHome(page)
    const l3 = section(page, 3)
    const consent = l3.getByRole("switch", { name: "let this device use an agent" })
    await expect(consent).toHaveAttribute("aria-checked", "false")
    await expect(l3.getByText("off · you decide")).toBeVisible()

    await consent.click()
    await expect(consent).toHaveAttribute("aria-checked", "true")
    await expect(l3.getByText("on · you agreed")).toBeVisible()
  })

  test("L5 courier receipt: SEND with every link off queues the message", async ({ page }) => {
    await openHome(page)
    const l5 = section(page, 5)
    await expect(l5.getByText("Press SEND. Turn links on or off at any time.", { exact: true })).toBeVisible()

    await l5.getByRole("button", { name: "SEND", exact: true }).click()
    await expect(l5.getByText("In your outbox: no path to them yet.", { exact: true })).toBeVisible()
    await expect(l5.getByRole("list", { name: "Delivery states" }).locator('[aria-current="step"]')).toHaveText(
      "queued",
    )
  })

  test("L6 seek board: SEEK walks the list and settles", async ({ page }) => {
    await openHome(page)
    const l6 = section(page, 6)
    const idle = "Set which networks are in range, then press SEEK."
    await expect(statusLine(l6, idle)).toHaveCount(1)

    await l6.getByRole("button", { name: "SEEK", exact: true }).click()
    await expect(statusLine(l6, idle)).toHaveCount(0)
    await expect(statusLine(l6, /Joined Network [A-D]|NONE IN RANGE/)).toHaveCount(1, { timeout: 20_000 })
  })

  test("L6 thin bridge: asking it to do more is refused", async ({ page }) => {
    await openHome(page)
    const l6 = section(page, 6)
    // The detail (does / does not) starts open under the bridge band.
    await expect(l6.getByRole("button", { name: "Bridge: what it does and does not do" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    await expect(l6.getByText("REFUSED: bridges stay thin", { exact: true })).toHaveCount(0)

    await l6.getByRole("button", { name: "MAKE THE BRIDGE DO MORE" }).click()
    await expect(l6.getByText("REFUSED: bridges stay thin", { exact: true })).toBeVisible()
  })

  test("L7 presence map: picking the relay says it cannot be a gateway", async ({ page }) => {
    await openHome(page)
    const l7 = section(page, 7)

    await l7.getByRole("button", { name: /^relay:/ }).click()
    await expect(statusLine(l7, "Relays only repeat. They cannot be gateways.")).toHaveCount(1)
    const internet = l7.getByRole("radiogroup", { name: "internet for the relay" })
    await expect(internet.getByRole("radio").first()).toBeDisabled()
  })

  test("L8 store map: pouring a regional map", async ({ page }) => {
    await openHome(page)
    const l8 = section(page, 8)
    const idle = "Nothing poured yet. Each button pours one batch into this store."
    await expect(statusLine(l8, idle)).toHaveCount(1)

    await l8.getByRole("button", { name: "regional map", exact: true }).click()
    await expect(statusLine(l8, idle)).toHaveCount(0)
    await expect(statusLine(l8, "a regional map")).toHaveCount(1)
  })

  test("L9 bench: breaking a layer starts the agent", async ({ page }) => {
    await openHome(page)
    const l9 = section(page, 9)
    await expect(l9.getByText("watching every layer this device runs · all quiet")).toBeVisible()

    await l9.getByRole("button", { name: "MESSAGES STUCK (layer 5)" }).click()
    await expect(l9.getByText(/^! messaging: messages stay in the outbox after a link comes back$/)).toBeVisible()
    await expect(l9.getByText("watching every layer this device runs · all quiet")).toHaveCount(0)
  })
})
