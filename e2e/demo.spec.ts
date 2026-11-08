import type { Locator, Page } from "@playwright/test"
import { clickNavRow, DEMO_MODE_KEY, demoMain, layoutOf, openDemo, shellRoot, sidebarNav, statusLine, waitForView } from "./demo-fixtures"
import { expect, test } from "./fixtures"

// Click-through of the /demo dashboard (plan P4) on a phone (375 px: the sidebar is a drawer) and a
// desktop (1280 px: docked sidebar with the icon rail). Runs against the production build.
//
// Every test opens its own page and starts the sample world fresh (only the mode / rail / cookie
// keys persist in localStorage, and each test has its own context). Demo timers run on real
// setTimeout at virtual durations (1.5–9 s chains, a real 60 s listen); the action tests run under
// `reducedMotion: "reduce"`, where every slice dispatches its end state in the same tick, with ONE
// exception: Ada's reply (slices/messages.ts `messages/reply`) is always scheduled at a real 2.6 s,
// so the one expect that waits for it carries its own longer timeout. Under reduced motion a few
// things differ from the animated run and are NOT asserted in those tests: STARTING / blinking /
// "working" busy states are never observable, the agent reply appears whole (no "agent is replying"
// announcement), "Listening for a minute." and "Check started." are not announced and the "running
// on trial" event is skipped. The "animated path" describe at the end covers a few of those states
// without reduced motion.

const CONSENT_KEY = "111-cookie-consent"
const DRAWER_WIDTH_PX = 288 // w-72

/** Service rows of the sidebar (ADVANCED mode): name + state, in registry order (engine/world.ts). */
const SERVICES = [
  ["agent", "Local AI agent", "LIVE"],
  ["model", "Local model", "LIVE"],
  ["mesh", "Mesh link", "LIVE"],
  ["radio", "Long-range radio", "NOT SET"],
  ["kb", "Knowledge base", "LIVE"],
  ["gateway", "Internet gateway", "NOT SET"],
  ["messaging", "Messaging", "LIVE"],
  ["bridge", "Bridge", "NOT SET"],
  ["storage", "Storage", "LIVE"],
  ["repairs", "Repairs", "LIVE"],
] as const

/** Settings layer pages: sidebar row label is "L<n> · <title>", the page h1 is the title. */
const LAYER_TITLES = [
  "Knowledge",
  "Install & updates",
  "Identity",
  "Intelligence",
  "Interface",
  "Messaging & data",
  "Transport",
  "Relay & presence",
  "Storage",
  "Self-healing",
] as const

const NODE_NAME = "Workshop laptop"
const BOARD_NAME = "USB radio board"
const BRIDGE_PROPOSAL = "Start the bridge between long-range radio and Wi-Fi"
const REPAIR_PROPOSAL = "Retry the outbox when a link comes back"
/** Seeded a–z2–7 grouped labels (lib/labels.ts groupedLabel). */
const LABEL = "[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{2}"

// ------------------------------------------------------------------------------------- helpers

/** The sidebar panel (docked, rail or the drawer dialog): the shell root's child that carries data-layout. */
const sidebarPanel = (page: Page): Locator => page.locator("[data-demo-shell] > div[data-layout]")

/** The content column (header + main): the shell root's child without data-layout. */
const contentColumn = (page: Page): Locator => page.locator("[data-demo-shell] > div:not([data-layout])")

/** The sidebar nav by CSS, so hidden-drawer text can still be asserted with toHaveText/toHaveCount. */
const navDom = (page: Page): Locator => page.locator('nav[aria-label="Main"]')

/** The main area's h1 (every view but not-found renders exactly one). */
const viewTitle = (page: Page): Locator => demoMain(page).locator("h1").first()

/** The header title line: the one font-pixel-line <p> of the content column (it has no role by design). */
const headerTitle = (page: Page): Locator => contentColumn(page).locator("p.font-pixel-line")

/** The header's attention badge link ("1 item needs you" / "3 items need you"); absent at count 0. */
const attentionBadge = (page: Page): Locator => contentColumn(page).getByRole("link", { name: /^\d+ items? needs? you$/ })

/** The MENU trigger (drawer layout only); includeHidden because the content column is inert while the drawer is open. */
const menuButton = (page: Page): Locator => page.getByRole("button", { name: "MENU", exact: true, includeHidden: true })

const drawer = (page: Page): Locator => page.getByRole("dialog", { name: "Menu" })

/** The shell's one polite live region. */
const liveRegion = (page: Page): Locator => shellRoot(page).locator('[role="status"][aria-live="polite"][aria-atomic="true"]')

/**
 * The sidebar's Messages row reads "Messages", then its signal count badge: the visible number and
 * the sr-only "<n> new" (none at 0). Asserted on the row's text so it also works inside the closed
 * drawer (an accessible name computed with includeHidden folds the aria-hidden number in).
 */
async function expectMessagesCount(page: Page, n: number): Promise<void> {
  const row = navDom(page).getByRole("link", { name: /^Messages/, includeHidden: true })
  await expect(row).toHaveText(n === 0 ? /^Messages$/ : new RegExp(`^Messages\\s*${n}\\s*${n} new$`))
}

/** The Agent's transcript landmark (role=log "Conversation"). */
const chatLog = (page: Page): Locator => demoMain(page).getByRole("log", { name: "Conversation", exact: true })

/** One transcript row (a direct child of the log) by its text: a reply, a note or your own line. */
const chatRow = (page: Page, text: string | RegExp): Locator => chatLog(page).locator(":scope > div").filter({ hasText: text })

const agentBox = (page: Page): Locator => page.getByRole("textbox", { name: "Message to the agent" })

/** A proposal card in the Agent view, by its title. */
const proposalCard = (page: Page, title: string): Locator =>
  demoMain(page).getByRole("region", { name: "Open proposals" }).getByRole("listitem").filter({ hasText: title })

/** In the drawer layout, open the drawer so the sidebar can be read and clicked. */
async function openSidebar(page: Page): Promise<void> {
  if ((await layoutOf(page)) !== "drawer") return
  if ((await menuButton(page).getAttribute("aria-expanded")) !== "true") await menuButton(page).click()
  await expect(drawer(page)).toBeVisible()
}

/** Open the Settings group in the sidebar (it opens by itself on a settings route). */
async function openSettingsGroup(page: Page): Promise<void> {
  await openSidebar(page)
  const toggle = sidebarNav(page).getByRole("button", { name: "Settings", exact: true })
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click()
  await expect(sidebarNav(page).getByRole("list", { name: "Settings", exact: true })).toBeVisible()
}

/**
 * Open Messages from the sidebar. The row's accessible name is "Messages 2 new" while its count
 * badge shows (unread + open requests), so the shared clickNavRow's exact "Messages" cannot match it.
 */
async function goToMessages(page: Page): Promise<void> {
  await openSidebar(page)
  await sidebarNav(page).getByRole("link", { name: /^Messages(\s|$)/ }).click()
  await waitForView(page)
}

/** Click a service row ("Local AI agent: LIVE" is its accessible name) and wait for the page. */
async function clickServiceRow(page: Page, name: string): Promise<void> {
  await openSidebar(page)
  const list = sidebarNav(page).getByRole("list", { name: "Services", exact: true })
  await list.getByRole("link", { name: new RegExp(`^${escapeRegExp(name)}: `) }).click()
  await waitForView(page)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Expect the route hash, the view h1 and the header title. */
async function expectView(page: Page, hash: string, h1: string | RegExp, header = h1): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`#${escapeRegExp(hash)}$`))
  await expect(viewTitle(page)).toHaveText(h1)
  await expect(headerTitle(page)).toHaveText(header)
}

/** The saved SIMPLE | ADVANCED mode. */
const savedMode = (page: Page) => page.evaluate((k) => localStorage.getItem(k), DEMO_MODE_KEY)

/** Tick both boxes and type the board's name in the "Confirm flashing" form, then flash. */
async function confirmFlash(page: Page): Promise<void> {
  const form = page.getByRole("form", { name: "Confirm flashing" })
  await form.getByRole("checkbox", { name: "I understand everything on the board will be erased" }).check()
  await form.getByRole("checkbox", { name: "This board is mine or I am allowed to flash it" }).check()
  await form.getByRole("textbox", { name: "Type the device's name to confirm" }).fill(BOARD_NAME)
  await form.getByRole("button", { name: "Flash now" }).click()
}

/**
 * Plug a board in from Devices and take it through consent, identify, flash and region until the
 * long-range radio is LIVE. Instant under reduced motion. Ends on the board's page.
 */
async function setUpRadio(page: Page): Promise<void> {
  await clickNavRow(page, "Devices")
  await page.getByRole("button", { name: "DEMO plug in a radio board" }).click()
  await page.getByRole("button", { name: "Allow once", exact: true }).click()
  await page.getByRole("link", { name: "See the firmware offer" }).click()
  await expect(viewTitle(page)).toHaveText(BOARD_NAME)
  await page.getByRole("button", { name: "Flash firmware…" }).click()
  await confirmFlash(page)
  await page.getByRole("radio", { name: "Europe", exact: true }).check()
  await page.getByRole("button", { name: "Set region" }).click()
  await expect(page.getByText("The board is set up.", { exact: true })).toBeVisible()
}

/** On Repairs: simulate the fault and wait until the fix waits at the gate (instant under reduced motion). */
async function simulateFault(page: Page): Promise<void> {
  await page.getByRole("button", { name: "DEMO simulate a fault" }).click()
  await expect(demoMain(page).getByText("WAITING FOR YOU", { exact: true })).toBeVisible()
}

/** Answer an inline two-step confirm ("Confirm: <text>") with Yes. */
async function confirmYes(page: Page, text: string): Promise<void> {
  const confirm = page.getByRole("group", { name: `Confirm: ${text}` })
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Yes", exact: true }).click()
}

// ------------------------------------------------------------------------------------- opening

test.describe("opening", () => {
  test("/demo lands on Overview: hash normalised, node name as h1, DEMO strip, header title, one Main nav", async ({ page, isMobile }) => {
    await openDemo(page)
    await expect(page).toHaveURL(/\/demo#\/overview$/)
    await expect(viewTitle(page)).toHaveText(NODE_NAME)
    await expect(headerTitle(page)).toHaveText("Overview")
    await expect(page.getByText("DEMO · sample data · nothing leaves this page", { exact: true })).toBeVisible()
    // Exactly one "Main" navigation landmark; on the desktop it is on screen, on a phone it waits inside the closed drawer.
    await expect(navDom(page)).toHaveCount(1)
    if (isMobile) await expect(sidebarNav(page)).toBeHidden()
    else await expect(sidebarNav(page)).toBeVisible()
  })

  test("the server render carries the DEMO strip and the noscript fallback", async ({ page }) => {
    const response = await page.request.get("/demo")
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("DEMO · sample data · nothing leaves this page")
    expect(html).toMatch(/<noscript>[\s\S]*This live demo needs script to run\. The rest of the site works without it\.[\s\S]*<\/noscript>/)
    // The main area is empty on the server: the hash route cannot be read there.
    expect(html).toMatch(/<main[^>]*id="demo-main"[^>]*>\s*<div[^>]*>\s*<\/div>\s*<\/main>/)
  })

  test("#demo-main is the scroll container; the page itself never scrolls", async ({ page, viewport }) => {
    await openDemo(page)
    const main = demoMain(page)
    await expect(main).toHaveJSProperty("tagName", "MAIN")
    expect(await main.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto")
    const doc = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      bodyOverflow: getComputedStyle(document.body).overflowY,
    }))
    expect(doc.innerWidth).toBe(viewport?.width)
    expect(doc.scrollHeight).toBeLessThanOrEqual(doc.innerHeight)
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.innerWidth)
    // The main area fits inside the viewport: its bottom is the page's bottom, not below it.
    const box = await main.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBeLessThanOrEqual(doc.innerHeight)
  })

  test("metadata: canonical is /demo and og:url ends in /demo", async ({ page }) => {
    await openDemo(page)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", /\/demo$/)
    await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute("content", /\/demo$/)
    await expect(page.locator('head meta[property="og:url"]')).not.toHaveAttribute("content", /\/$/)
  })

  test("document.title follows the view", async ({ page }) => {
    await openDemo(page)
    await expect(page).toHaveTitle("Overview · Live demo · 111 Network")
    await clickNavRow(page, "Devices")
    await expect(page).toHaveTitle("Devices · Live demo · 111 Network")
    await clickNavRow(page, "Nearby")
    await expect(page).toHaveTitle("Nearby · Live demo · 111 Network")
  })

  test("Back and Forward walk the in-app history (pushState + popstate)", async ({ page }) => {
    await openDemo(page)
    await clickNavRow(page, "Devices")
    await expectView(page, "/devices", "Devices")
    await clickNavRow(page, "Nearby")
    await expectView(page, "/nearby", "Nearby")

    await page.goBack()
    await expectView(page, "/devices", "Devices")
    await page.goBack()
    await expectView(page, "/overview", NODE_NAME, "Overview")
    await page.goForward()
    await expectView(page, "/devices", "Devices")
    // The sidebar follows the route that history brought back.
    await expect(navDom(page).locator('[aria-current="page"]')).toHaveCount(1)
    await expect(navDom(page).getByRole("link", { name: "Devices", exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page")
    await expect(page).toHaveTitle("Devices · Live demo · 111 Network")
  })
})

// --------------------------------------------------------------------------------- every view

test.describe("every view through the sidebar", () => {
  test("the five page rows land their views", async ({ page }) => {
    await openDemo(page)
    await clickNavRow(page, "Agent")
    await expectView(page, "/", "Agent")
    await clickNavRow(page, "Devices")
    await expectView(page, "/devices", "Devices")
    await clickNavRow(page, "Nearby")
    await expectView(page, "/nearby", "Nearby")
    await goToMessages(page)
    await expectView(page, "/messages", "Messages")
    await clickNavRow(page, "Overview")
    await expectView(page, "/overview", NODE_NAME, "Overview")
    await openSidebar(page) // the drawer closed on navigation; the active row is marked inside it
    await expect(sidebarNav(page).getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page")
    await expect(sidebarNav(page).locator('[aria-current="page"]')).toHaveCount(1)
  })

  test("ADVANCED mode: every service row lands its page", async ({ page }) => {
    await openDemo(page)
    await openSidebar(page)
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true })).toHaveCount(0)
    await sidebarPanel(page).getByRole("radio", { name: "ADVANCED", exact: true }).click()
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true })).toBeVisible()
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true }).getByRole("link")).toHaveCount(SERVICES.length)

    for (const [id, name] of SERVICES) {
      await clickServiceRow(page, name)
      await expectView(page, `/services/${id}`, name)
    }
    await expect.poll(() => savedMode(page)).toBe("advanced")
  })

  test("Settings: Essentials and every L0..L9 page", async ({ page }) => {
    await openDemo(page)
    await openSettingsGroup(page)
    await sidebarNav(page).getByRole("link", { name: "Essentials", exact: true }).click()
    await waitForView(page)
    await expectView(page, "/settings", "Settings")

    for (let n = 0; n <= 9; n++) {
      const title = LAYER_TITLES[n] as string
      await openSettingsGroup(page)
      await sidebarNav(page).getByRole("link", { name: `L${n} · ${title}`, exact: true }).click()
      await waitForView(page)
      await expectView(page, `/settings/l${n}`, title, `L${n} · ${title}`)
      await expect(demoMain(page).getByText(`Layer ${n}`, { exact: true })).toBeVisible()
    }
  })

  test("Knowledge base: index, a drawer, a note", async ({ page }) => {
    await openDemo(page, "#/kb")
    await expectView(page, "/kb", "Knowledge base")
    await page.getByRole("navigation", { name: "Drawers" }).getByRole("link", { name: /^RECIPES drawer/ }).click()
    await waitForView(page)
    await expectView(page, "/kb/recipes", "Recipes", "Knowledge base")
    await expect(demoMain(page).getByText("knowledge base · drawer", { exact: true })).toBeVisible()
    await demoMain(page).getByRole("link", { name: /^Set up a radio board/ }).click()
    await waitForView(page)
    await expectView(page, "/kb/recipes/set-up-a-radio-board", "Set up a radio board", "Knowledge base")
    await expect(demoMain(page).getByText("knowledge base · note", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByRole("link", { name: "Long-range radio", exact: true })).toBeVisible()
  })

  test("Knowledge base: Find a note filters the fronts, says when nothing matches, and Clear resets", async ({ page }) => {
    await openDemo(page, "#/kb")
    const find = demoMain(page).getByRole("searchbox", { name: "Find a note" })
    const clear = demoMain(page).getByRole("button", { name: "Clear", exact: true })
    const drawers = page.getByRole("navigation", { name: "Drawers" })
    await expect(clear).toBeDisabled()
    await expect(drawers.getByRole("link", { name: /^RECIPES drawer, 3 notes$/ })).toHaveCount(1)

    await find.fill("radio")
    await expect(demoMain(page).getByText(/^(1 note matches|\d+ notes match)\.$/)).toBeVisible()
    // The fronts switch from note counts to match counts.
    await expect(drawers.getByRole("link", { name: /^RECIPES drawer, (1 match|\d+ matches)$/ })).toHaveCount(1)
    await expect(drawers.getByRole("link", { name: / drawer, \d+ notes?$/ })).toHaveCount(0)

    await find.fill("zzz")
    await expect(demoMain(page).getByText('No note matches "zzz".', { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("Try a shorter word, such as radio, phone or hub.", { exact: true })).toBeVisible()
    await expect(drawers.getByRole("link", { name: /^RECIPES drawer, no match$/ })).toHaveCount(1)

    await expect(clear).toBeEnabled()
    await clear.click()
    await expect(find).toHaveValue("")
    await expect(drawers.getByRole("link", { name: /^RECIPES drawer, 3 notes$/ })).toHaveCount(1)

    // Inside a drawer the sentence names it.
    await drawers.getByRole("link", { name: /^RECIPES drawer/ }).click()
    await waitForView(page)
    await demoMain(page).getByRole("searchbox", { name: "Find a note" }).fill("zzz")
    await expect(demoMain(page).getByText('No note in the Recipes drawer matches "zzz".', { exact: true })).toBeVisible()
  })

  test("a service page's Read the recipe opens its knowledge base note", async ({ page }) => {
    await openDemo(page, "#/services/radio")
    await expectView(page, "/services/radio", "Long-range radio")
    await demoMain(page).getByRole("link", { name: "Read the recipe", exact: true }).click()
    await waitForView(page)
    await expectView(page, "/kb/recipes/set-up-a-radio-board", "Set up a radio board", "Knowledge base")
    // "Used by" points back at the service.
    await expect(demoMain(page).getByRole("link", { name: "Long-range radio", exact: true })).toHaveAttribute("href", "#/services/radio")
  })

  test("Messages: the Ada conversation", async ({ page }) => {
    await openDemo(page, "#/messages")
    await demoMain(page).getByRole("link", { name: /^Ada\b/ }).click()
    await waitForView(page)
    await expectView(page, "/messages/ada", "Ada", "Conversation")
    await expect(page.getByRole("log", { name: "Conversation with Ada" })).toBeVisible()
    await expect(demoMain(page).getByText("Welcome to the workshop mesh!", { exact: false })).toBeVisible()
    await demoMain(page).getByRole("link", { name: "All messages", exact: true }).click()
    await waitForView(page)
    await expectView(page, "/messages", "Messages")
  })

  test("Devices: the board detail after plugging a board in", async ({ page, isMobile }) => {
    await openDemo(page, "#/devices")
    await expect(demoMain(page).getByText("Nothing connected yet.", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "DEMO plug in a radio board" }).click()
    await expect(page.getByText("Allow once?", { exact: true })).toBeVisible()
    // Below a 640 px shell the table folds its columns into one line.
    if (isMobile) await expect(demoMain(page).getByText("long-range radio board · driven by nothing yet · seen just now", { exact: true })).toBeVisible()
    // The row is named by its status dot's text: "USB radio board: NOT SET …".
    await demoMain(page).getByRole("link", { name: new RegExp(`^${escapeRegExp(BOARD_NAME)}: `) }).click()
    await waitForView(page)
    await expectView(page, "/devices/radio-board", BOARD_NAME, "Device")
    await expect(demoMain(page).getByRole("link", { name: "All devices", exact: true })).toBeVisible()
  })

  test("an unknown hash shows the not-found view", async ({ page }) => {
    await page.goto("/demo#/nope")
    await expect(shellRoot(page)).toHaveCount(1)
    await expect(demoMain(page).getByText("No such view", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("This address does not match any page of the dashboard.", { exact: true })).toBeVisible()
    await expect(headerTitle(page)).toHaveText("Not found")
    await demoMain(page).getByRole("link", { name: "Go to Overview" }).click()
    await waitForView(page)
    await expectView(page, "/overview", NODE_NAME, "Overview")
  })

  test("an unknown service id shows No such service inside the services dispatcher", async ({ page }) => {
    await page.goto("/demo#/services/nope")
    await expect(shellRoot(page)).toHaveCount(1)
    await expect(demoMain(page).getByText("No such service", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("This node does not have a service called “nope”.", { exact: true })).toBeVisible()
    await expect(headerTitle(page)).toHaveText("Service")
    await expect(page).toHaveTitle("Service · Live demo · 111 Network")
    await demoMain(page).getByRole("link", { name: "Back to Overview" }).click()
    await waitForView(page)
    await expectView(page, "/overview", NODE_NAME, "Overview")
  })

  test("a service deep link in SIMPLE mode switches to ADVANCED", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "simple"), DEMO_MODE_KEY)
    await openDemo(page, "#/services/storage")
    await expectView(page, "/services/storage", "Storage")
    await openSidebar(page)
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true })).toBeVisible()
    await expect(sidebarPanel(page).getByRole("radio", { name: "ADVANCED", exact: true })).toHaveAttribute("aria-checked", "true")
    await expect(sidebarPanel(page).getByText("ADV", { exact: true })).toBeVisible()
    // Pinned: the switch a deep link makes at store init happens before the persistence effect
    // subscribes (engine/react.tsx), so the saved mode stays "simple" while a row click would save
    // "advanced". TODO product: should a service deep link persist "advanced" like a row click does?
    await expect.poll(() => savedMode(page)).toBe("simple")
  })
})

// --------------------------------------------------------------------------------- the drawer

test.describe("drawer (375 px)", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, "the drawer shows below 1024 px")
  })

  test("MENU opens the Menu dialog, focuses CLOSE, traps Tab, makes the content inert, Escape closes", async ({ page }) => {
    await openDemo(page)
    expect(await layoutOf(page)).toBe("drawer")
    const trigger = menuButton(page)
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(drawer(page)).toBeHidden()

    await trigger.click()
    const sheet = drawer(page)
    await expect(sheet).toBeVisible()
    await expect(sheet).toHaveAttribute("aria-modal", "true")
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    const close = sheet.getByRole("button", { name: "CLOSE", exact: true })
    await expect(close).toBeFocused()
    // The content column (header + main) is inert while the drawer is open.
    await expect(page.locator("[data-demo-shell] > div[inert]")).toHaveCount(1)
    await expect(page.locator("[data-demo-shell] > div[inert] #demo-main")).toHaveCount(1)

    // The real tab ring: the app's FOCUSABLE query filtered to laid-out elements (the collapsed Settings list is hidden).
    const focusInside = () => sheet.evaluate((el) => el.contains(document.activeElement))
    const stops = await sheet.locator('a[href], button:not([disabled]):not([tabindex="-1"])').filter({ visible: true }).count()
    expect(stops).toBeGreaterThan(5)
    for (let i = 0; i < stops; i++) {
      await page.keyboard.press("Tab")
      expect(await focusInside(), `after Tab #${i + 1}`).toBe(true)
    }
    // One full cycle forward wraps back to the first stop: CLOSE.
    await expect(close).toBeFocused()
    for (let i = 0; i < stops; i++) {
      await page.keyboard.press("Shift+Tab")
      expect(await focusInside(), `after Shift+Tab #${i + 1}`).toBe(true)
    }
    await expect(close).toBeFocused()

    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(page.locator("[data-demo-shell] > div[inert]")).toHaveCount(0)
  })

  test("a click on the overlay closes the drawer", async ({ page }) => {
    await openDemo(page)
    await menuButton(page).click()
    await expect(drawer(page)).toBeVisible()
    // The overlay is the shell root's only aria-hidden child (the panel itself is the dialog).
    const overlay = page.locator('[data-demo-shell] > div[aria-hidden="true"]')
    await expect(overlay).toHaveCount(1)
    // Right of the panel (w-72), on the dimmed content.
    await overlay.click({ position: { x: DRAWER_WIDTH_PX + 40, y: 300 } })
    await expect(drawer(page)).toBeHidden()
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false")
  })

  test("a nav row closes the drawer and lands the view", async ({ page }) => {
    await openDemo(page)
    await menuButton(page).click()
    const sheet = drawer(page)
    await sheet.getByRole("link", { name: "Devices", exact: true }).click()
    await expect(sheet).toBeHidden()
    await waitForView(page)
    await expectView(page, "/devices", "Devices")
    await expect(demoMain(page)).toBeFocused()
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false")
  })
})

// ------------------------------------------------------------------------------- the desktop

test.describe("docked sidebar (1280 px)", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "the docked sidebar shows from 1024 px")
  })

  test("no MENU; << collapses to the rail (with its Advanced mode button) and >> expands it again", async ({ page }) => {
    await openDemo(page)
    expect(await layoutOf(page)).toBe("docked")
    await expect(page.getByRole("button", { name: "MENU", exact: true })).toHaveCount(0)
    const panel = sidebarPanel(page)
    const width = () => panel.evaluate((el) => Math.round(el.getBoundingClientRect().width))
    expect(await width()).toBeGreaterThan(200)
    await expect(panel.getByText("collapse", { exact: true })).toBeVisible()

    const collapse = panel.getByRole("button", { name: "Collapse sidebar" })
    await expect(collapse).toHaveAttribute("aria-expanded", "true")
    await expect(collapse).toContainText("<<")
    await collapse.click()

    await expect(shellRoot(page)).toHaveAttribute("data-layout", "rail")
    await expect(panel).toHaveAttribute("data-layout", "rail")
    const expand = panel.getByRole("button", { name: "Expand sidebar" })
    await expect(expand).toHaveAttribute("aria-expanded", "false")
    await expect(expand).toContainText(">>")
    await expect.poll(width).toBeLessThan(80)
    // Row labels are gone from view: two-letter glyphs stand in, the word "collapse" too; the sr label still names the row.
    await expect(panel.getByText("OV", { exact: true })).toBeVisible()
    await expect(panel.getByText("collapse", { exact: true })).toHaveCount(0)
    await expect(panel.getByRole("link", { name: "Overview", exact: true })).toHaveCount(1)
    await expect.poll(() => page.evaluate(() => localStorage.getItem("111.demo.rail"))).toBe("1")

    // The rail's mode switch is one pressed button: "SIM" -> "ADV", and the services group appears.
    const modeButton = panel.getByRole("button", { name: "Advanced mode", exact: true })
    await expect(modeButton).toHaveAttribute("aria-pressed", "false")
    await expect(modeButton).toHaveText("SIM")
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true })).toHaveCount(0)
    await modeButton.click()
    await expect(modeButton).toHaveAttribute("aria-pressed", "true")
    await expect(modeButton).toHaveText("ADV")
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true }).getByRole("link")).toHaveCount(SERVICES.length)
    await expect.poll(() => savedMode(page)).toBe("advanced")

    await expand.click()
    await expect(shellRoot(page)).toHaveAttribute("data-layout", "docked")
    await expect(collapse).toHaveAttribute("aria-expanded", "true")
    await expect.poll(width).toBeGreaterThan(200)
    await expect(panel.getByRole("radio", { name: "ADVANCED", exact: true })).toHaveAttribute("aria-checked", "true")
  })

  test("SIMPLE | ADVANCED is a radiogroup; arrow keys move and select", async ({ page }) => {
    await openDemo(page)
    const group = sidebarPanel(page).getByRole("radiogroup", { name: "Interface mode" })
    const simple = group.getByRole("radio", { name: "SIMPLE", exact: true })
    const advanced = group.getByRole("radio", { name: "ADVANCED", exact: true })
    await expect(simple).toHaveAttribute("aria-checked", "true")
    await expect(advanced).toHaveAttribute("aria-checked", "false")
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true })).toHaveCount(0)

    await simple.focus()
    await page.keyboard.press("ArrowRight")
    await expect(advanced).toHaveAttribute("aria-checked", "true")
    await expect(advanced).toBeFocused()
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true })).toBeVisible()
    await expect(sidebarPanel(page).getByText("ADV", { exact: true })).toBeVisible()

    await page.keyboard.press("ArrowLeft")
    await expect(simple).toHaveAttribute("aria-checked", "true")
    await expect(simple).toBeFocused()
    await expect(sidebarNav(page).getByRole("list", { name: "Services", exact: true })).toHaveCount(0)
    await expect.poll(() => savedMode(page)).toBe("simple")
  })
})

// ------------------------------------------------------------------------------ layout crossing

test.describe("layout crossing (the shell measures its own width)", () => {
  test("widening past 1024 px closes an open drawer and docks the sidebar; narrowing brings MENU back", async ({ page, isMobile }) => {
    await openDemo(page)
    if (isMobile) {
      await menuButton(page).click()
      await expect(drawer(page)).toBeVisible()
    }

    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(shellRoot(page)).toHaveAttribute("data-layout", "docked")
    await expect(drawer(page)).toHaveCount(0)
    await expect(page.getByRole("button", { name: "MENU", exact: true })).toHaveCount(0)
    await expect(sidebarNav(page)).toBeVisible()
    await expect(sidebarPanel(page).getByRole("button", { name: "Collapse sidebar" })).toBeVisible()
    // The page still never scrolls.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.setViewportSize({ width: 375, height: 812 })
    await expect(shellRoot(page)).toHaveAttribute("data-layout", "drawer")
    await expect(menuButton(page)).toBeVisible()
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false")
    await expect(sidebarNav(page)).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})

// ------------------------------------------------------------------- one DEMO action per view

test.describe("one DEMO action per view (reduced motion)", () => {
  test.use({ reducedMotion: "reduce" })

  test("Devices: plug in a board, allow once, flash with two boxes and the typed name, pick a region, radio LIVE", async ({
    page,
  }) => {
    await openDemo(page, "#/devices")
    const empty = demoMain(page).getByText("Nothing connected yet.", { exact: true })
    await expect(empty).toBeVisible()
    await page.getByRole("button", { name: "DEMO plug in a radio board" }).click()
    await expect(empty).toHaveCount(0)
    await expect(page.getByText("Allow once?", { exact: true })).toBeVisible()
    await expect(page.getByText(`Let the node identify ${BOARD_NAME}, once.`, { exact: false })).toBeVisible()

    await page.getByRole("button", { name: "Allow once", exact: true }).click()
    // Instant under reduced motion: "Identifying the board…" never shows.
    await expect(page.getByText("Identified: a long-range radio board.", { exact: true })).toBeVisible()
    await expect(page.getByText("NEEDS FIRMWARE", { exact: true }).first()).toBeVisible()
    await page.getByRole("link", { name: "See the firmware offer" }).click()
    await expectView(page, "/devices/radio-board", BOARD_NAME, "Device")
    await expect(page.getByText("This board has no usable firmware.", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Flash firmware…" }).click()
    const form = page.getByRole("form", { name: "Confirm flashing" })
    await expect(form).toBeVisible()
    const flashNow = form.getByRole("button", { name: "Flash now" })
    await expect(flashNow).toHaveAttribute("aria-disabled", "true")
    await expect(form.getByText("Still needed: tick both boxes and type the name exactly as shown.", { exact: true })).toBeVisible()
    await form.getByRole("checkbox", { name: "I understand everything on the board will be erased" }).check()
    await form.getByRole("checkbox", { name: "This board is mine or I am allowed to flash it" }).check()
    // The name is case-sensitive: a wrong case still blocks.
    await form.getByRole("textbox", { name: "Type the device's name to confirm" }).fill(BOARD_NAME.toLowerCase())
    await expect(flashNow).toHaveAttribute("aria-disabled", "true")
    await form.getByRole("textbox", { name: "Type the device's name to confirm" }).fill(BOARD_NAME)
    await expect(flashNow).not.toHaveAttribute("aria-disabled", "true")
    await flashNow.click()

    await expect(page.getByText("Flashed: mesh firmware for this board.", { exact: true })).toBeVisible()
    await expect(page.getByText("Pick your region", { exact: true })).toBeVisible()
    const setRegion = page.getByRole("button", { name: "Set region" })
    await expect(setRegion).toHaveAttribute("aria-disabled", "true")
    await page.getByRole("radio", { name: "Europe", exact: true }).check()
    await setRegion.click()

    await expect(page.getByText("The board is set up.", { exact: true })).toBeVisible()
    await expect(page.getByText("Region: Europe.", { exact: true })).toBeVisible()
    await expect(page.getByText("Running with the Europe settings. The board is listening on the mesh.", { exact: true })).toBeVisible()
    // Cross-view: the Long-range radio service row reads LIVE (ADVANCED mode shows the services group).
    await openSidebar(page)
    await sidebarPanel(page).getByRole("radio", { name: "ADVANCED", exact: true }).click()
    await expect(navDom(page).getByText("Long-range radio: LIVE", { exact: true })).toHaveCount(1)
  })

  test("Devices: DEMO unplug the radio board is two-step and takes the radio, its nodes and the bridge with it", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "advanced"), DEMO_MODE_KEY)
    await openDemo(page, "#/devices")
    await setUpRadio(page)
    await expect(navDom(page).getByText("Long-range radio: LIVE", { exact: true })).toHaveCount(1)
    await expect(navDom(page).getByText("Bridge: NOT SET", { exact: true })).toHaveCount(1)

    await page.getByRole("button", { name: "DEMO unplug the radio board" }).click()
    const confirm = page.getByRole("group", { name: `Confirm: Unplug ${BOARD_NAME}? The radio stops, and the nodes it heard leave Nearby. Go ahead` })
    await expect(confirm).toBeVisible()
    // No: nothing happens.
    await confirm.getByRole("button", { name: "No", exact: true }).click()
    await expect(confirm).toHaveCount(0)
    await expect(viewTitle(page)).toHaveText(BOARD_NAME)

    await page.getByRole("button", { name: "DEMO unplug the radio board" }).click()
    await confirmYes(page, `Unplug ${BOARD_NAME}? The radio stops, and the nodes it heard leave Nearby. Go ahead`)
    await expectView(page, "/devices", "Devices")
    await expect(demoMain(page).getByText("Nothing connected yet.", { exact: true })).toBeVisible()
    await expect(liveRegion(page)).toHaveText("The radio board was unplugged.")
    await expect(navDom(page).getByText("Long-range radio: NOT SET", { exact: true })).toHaveCount(1)
    // Cross-view: Nearby is empty again.
    await clickNavRow(page, "Nearby")
    await expect(demoMain(page).getByText("No nearby nodes heard", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByTestId("nearby-node")).toHaveCount(0)
  })

  test("Nearby: nodes heard once the radio is live, then DEMO listen for a minute", async ({ page }) => {
    await openDemo(page, "#/nearby")
    await expect(demoMain(page).getByText("No nearby nodes heard", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByTestId("nearby-listen")).toHaveCount(0)

    await setUpRadio(page)
    await clickNavRow(page, "Nearby")
    await expect(demoMain(page).getByText("No nearby nodes heard", { exact: true })).toHaveCount(0)
    await demoMain(page).getByRole("radiogroup", { name: "Show nearby nodes as" }).getByRole("radio", { name: "LIST", exact: true }).click()
    await expect(demoMain(page).getByTestId("nearby-node")).toHaveCount(3)
    for (const name of ["Ridge repeater", "Valley hub", "Bram"]) {
      // `has` with an exact text: "heard through Ridge repeater" on the other rows must not count.
      await expect(demoMain(page).getByTestId("nearby-node").filter({ has: page.getByText(name, { exact: true }) })).toHaveCount(1)
    }
    await expect(demoMain(page).getByText("forwards sealed traffic; cannot read it", { exact: true })).toBeVisible()

    // The whole minute lands at once under reduced motion (a real 60 s otherwise); the stamp is the virtual clock (09:0x).
    const listen = demoMain(page).getByTestId("nearby-listen")
    await listen.getByRole("button", { name: "DEMO listen for a minute" }).click()
    await expect(listen).toContainText(/Last listen, 09:0\d: Listened for a minute and heard Ridge repeater twice, Valley hub and Bram\.$/)
    await expect(listen.getByRole("button", { name: "DEMO listen for a minute" })).toBeVisible()
    // Cross-view: Overview's verdict and nearby card follow the heard nodes.
    await clickNavRow(page, "Overview")
    await expect(demoMain(page).getByText("Your node is running and connected to nearby nodes: messages can flow.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("At least one nearby node has been heard, so messages can flow.", { exact: true })).toBeVisible()
  })

  test("Nearby RADAR: the drawing's accessible name and legend follow the heard nodes and the home hub", async ({ page }) => {
    await openDemo(page, "#/nearby")
    const radar = demoMain(page).getByTestId("nearby-radar")
    // The radar is a lazy chunk; its sr fallback "Loading the radar." gives way to the drawing.
    await expect(radar.getByRole("img")).toHaveAttribute("aria-label", "Radar. Workshop laptop is in the middle. No nearby nodes heard.")
    await expect(radar.getByText("on the radar", { exact: true })).toBeVisible()
    await expect(radar.getByText("Only this node so far.", { exact: true })).toBeVisible()
    await expect(radar.getByText("demo node", { exact: true })).toHaveCount(0)

    await setUpRadio(page)
    await clickNavRow(page, "Nearby")
    await expect(radar.getByRole("img")).toHaveAttribute("aria-label", /^Radar\. Workshop laptop is in the middle\. Heard: Ridge repeater, Valley hub, Bram\.$/)
    await expect(radar.getByText("Only this node so far.", { exact: true })).toHaveCount(0)
    await expect(radar.getByText("demo node", { exact: true })).toHaveCount(3)
    // Exact text: the other two legend rows say "heard through Ridge repeater".
    await expect(radar.getByRole("listitem").filter({ has: page.getByText("Ridge repeater", { exact: true }) })).toHaveCount(1)

    // Cross-view: a message to Ada makes the home hub take custody, so it blips in as the home link (not a nearby node).
    await goToMessages(page)
    await demoMain(page).getByRole("link", { name: /^Ada\b/ }).click()
    await waitForView(page)
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("Is the bench free?")
    await page.getByRole("button", { name: "send", exact: true }).click()
    await expect(demoMain(page).getByTestId("msg-m5").locator("[data-state]")).toHaveAttribute("data-state", "delivered")
    await clickNavRow(page, "Nearby")
    await expect(radar.getByRole("img")).toHaveAttribute(
      "aria-label",
      /^Radar\. Workshop laptop is in the middle\. Heard: Ridge repeater, Valley hub, Bram\. Workshop hub, your home hub, is shown apart over Wi-Fi\.$/,
    )
    // The drawing labels the home hub too; the legend row is the one with the "demo node" note.
    await expect(radar.getByRole("listitem").filter({ hasText: "Workshop hub" }).filter({ hasText: "home link · Wi-Fi" })).toHaveCount(1)
    await expect(radar.getByText("demo node", { exact: true })).toHaveCount(4)
    await demoMain(page).getByRole("radiogroup", { name: "Show nearby nodes as" }).getByRole("radio", { name: "LIST", exact: true }).click()
    const home = demoMain(page).getByTestId("nearby-home")
    await expect(home).toContainText("Workshop hub")
    await expect(home).toContainText(/took a sealed copy at \d\d:\d\d:\d\d/)
    await expect(demoMain(page).getByTestId("nearby-node")).toHaveCount(3)
  })

  test("Messages: SEND to Ada steps the glyph to delivered and Ada's demo reply arrives", async ({ page }) => {
    await openDemo(page, "#/messages/ada")
    await expect(demoMain(page).getByTestId("msg-m5")).toHaveCount(0)
    const box = page.getByRole("textbox", { name: "Message", exact: true })
    await box.fill("Hello Ada, is the bench radio free tonight?")
    await page.getByRole("button", { name: "send", exact: true }).click()

    const own = demoMain(page).getByTestId("msg-m5")
    await expect(own).toContainText("Hello Ada, is the bench radio free tonight?")
    await expect(own.locator("[data-state]")).toHaveAttribute("data-state", "delivered")
    await expect(own).toContainText("delivered")
    await expect(own).toContainText(`custody: Workshop hub held a sealed copy until Ada's node collected it. It could not read it.`)
    await expect(box).toHaveValue("")
    // Ada's reply is the one step that is NOT instant under reduced motion: slices/messages.ts schedules
    // it at a real MESSAGE_TIMING.replyMs (2.6 s) on the demo scheduler, so this expect gets more room.
    const reply = demoMain(page).getByText("Got it, thanks! My phone picked it up from the hub.", { exact: true })
    await expect(reply).toBeVisible({ timeout: 15_000 })
    await expect(demoMain(page).locator("li", { hasText: "Got it, thanks!" }).getByText("demo message", { exact: true })).toHaveCount(1)

    // Cross-view: the Messages list shows Ada's reply as the thread's last line.
    await demoMain(page).getByRole("link", { name: "All messages", exact: true }).click()
    await waitForView(page)
    await expect(demoMain(page).getByRole("link", { name: /^Ada\b/ })).toContainText("Got it, thanks! My phone picked it up from the hub.")
  })

  test("Messages: accepting the request drops the Messages count from 2 to 1", async ({ page }) => {
    await openDemo(page, "#/messages")
    await expectMessagesCount(page, 2)
    await expect(demoMain(page).getByText("message requests (1)", { exact: true })).toBeVisible()

    await demoMain(page).getByRole("button", { name: new RegExp(`^accept the request from ${LABEL}$`) }).click()
    // The accept is announced at once; the navigation's "Opened Conversation." is held by the 2 s throttle and wins after it.
    await expect(liveRegion(page)).toHaveText(new RegExp(`^Accepted the request from ${LABEL}\\.$`))
    await waitForView(page)
    await expect(page).toHaveURL(new RegExp(`#/messages/${LABEL}$`))
    await expect(headerTitle(page)).toHaveText("Conversation")
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible()
    await expectMessagesCount(page, 1)
    await expect(liveRegion(page)).toHaveText("Opened Conversation.")
  })

  test("Messages: ignoring the request takes it out of the count; show again brings it back", async ({ page }) => {
    await openDemo(page, "#/messages")
    await expectMessagesCount(page, 2)

    await demoMain(page).getByRole("button", { name: /^ignore the request from/ }).click()
    await expect(demoMain(page).getByText("message requests (0)", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("No new requests.", { exact: true })).toBeVisible()
    await expectMessagesCount(page, 1)
    await expect(liveRegion(page)).toHaveText(new RegExp(`^Ignored the request from ${LABEL}\\. It stays pending on the node and nothing was sent\\.$`))

    await demoMain(page).getByRole("group").filter({ hasText: "ignored requests (1)" }).locator("summary").click()
    await demoMain(page).getByRole("button", { name: /^show again the request from/ }).click()
    await expect(demoMain(page).getByText("message requests (1)", { exact: true })).toBeVisible()
    await expectMessagesCount(page, 2)
  })

  test("Messages: forget request is two-step and discards the request; the count and the badge follow", async ({ page }) => {
    await openDemo(page, "#/messages")
    await expect(attentionBadge(page)).toHaveAccessibleName("1 item needs you")
    await demoMain(page).getByRole("button", { name: new RegExp(`^forget request from ${LABEL}$`) }).click()
    await confirmYes(page, "forget this request (their held words are discarded; if they write again it comes back)")
    await expect(demoMain(page).getByText(/^message requests \(\d\)$/)).toHaveCount(0)
    await expect(demoMain(page).getByText("Hello! I saw your node's card on the workshop board.", { exact: false })).toHaveCount(0)
    await expect(liveRegion(page)).toHaveText(
      new RegExp(`^Forgot the request from ${LABEL}\\. Their held words are discarded; if they write again it comes back\\.$`),
    )
    await expectMessagesCount(page, 1)
    // Nothing needs you any more: the header badge is gone.
    await expect(attentionBadge(page)).toHaveCount(0)
  })

  test("Messages: Cancel sending a queued message is two-step and leaves a placeholder", async ({ page }) => {
    await openDemo(page, "#/messages/bram")
    const queued = demoMain(page).getByTestId("msg-m2")
    await expect(queued.locator("[data-state]")).toHaveAttribute("data-state", "queued")
    await expect(demoMain(page).getByText("Waiting in the outbox for a path to them. When this node reaches the internet, waiting messages leave the outbox.", { exact: true })).toBeVisible()

    // The aria-label carries the first 40 characters of the message.
    await queued.getByRole("button", { name: /^Cancel sending: Hi Bram, can you bring the spare/ }).click()
    await confirmYes(page, "Cancel sending this message")
    await expect(queued.locator("[data-state]")).toHaveAttribute("data-state", "cancelled")
    await expect(queued).toContainText("cancelled")
    await expect(queued).toContainText(
      "You cancelled this before it left. Its words are not sent; an empty placeholder goes in their place so no message number is skipped.",
    )
    await expect(queued.getByRole("button", { name: /^Cancel sending/ })).toHaveCount(0)
    await expect(liveRegion(page)).toHaveText("Cancelled. It will not be sent; an empty placeholder goes in its place.")
    // The outbox block is gone with the last waiting message.
    await expect(demoMain(page).getByRole("button", { name: "DEMO connect to the internet" })).toHaveCount(0)
  })

  test("Agent: a starter fills the box, send streams a reply with at most four tool lines and a demo reply note", async ({ page }) => {
    await openDemo(page, "#/")
    const box = agentBox(page)
    await expect(box).toHaveValue("")
    await page.getByRole("button", { name: "check this node", exact: true }).click()
    await expect(box).toHaveValue("Check this node end to end and tell me what needs attention.")

    await page.getByRole("button", { name: "send", exact: true }).click()
    // The transcript rows carry an sr-only "You: " / "Agent: " prefix, so match by content, not exact text.
    await expect(chatLog(page).getByText(/^You: Check this node end to end and tell me what needs attention\.$/)).toBeVisible()
    const reply = chatRow(page, "Your node is running.")
    await expect(reply).toHaveCount(1)
    await expect(reply.getByText("demo reply", { exact: true })).toBeVisible()
    await expect(reply).toContainText("It has no internet right now, which is fine: the mesh works without it.")
    const tools = reply.getByRole("listitem").filter({ hasText: /^\[.+\]$/ })
    const toolCount = await tools.count()
    expect(toolCount).toBeGreaterThanOrEqual(1)
    expect(toolCount).toBeLessThanOrEqual(4)
    await expect(box).toHaveValue("")
    // Cross-view: the transcript lives in the store, so it is still there after a trip to Overview.
    // (A chat reply writes no store event, so Overview's activity log stays empty here.)
    await clickNavRow(page, "Overview")
    await expect(viewTitle(page)).toHaveText(NODE_NAME)
    await clickNavRow(page, "Agent")
    await expect(chatLog(page).getByText(/^You: Check this node end to end and tell me what needs attention\.$/)).toBeVisible()
    await expect(reply).toHaveCount(1)
  })

  test("Agent: unknown text gets the fallback sentence and the four starters", async ({ page }) => {
    await openDemo(page, "#/")
    const box = agentBox(page)
    await box.fill("hello there")
    await box.press("Enter")
    await expect(chatLog(page).getByText(/^Agent: This is a demo, I only know a few questions\. Try one of these:$/)).toBeVisible()
    const fallback = chatRow(page, "This is a demo, I only know a few questions.")
    await expect(fallback).toHaveCount(1)
    for (const label of ["check this node", "set up my radio", "why is the radio quiet?", "what can this device run?"]) {
      await expect(fallback.getByRole("button", { name: label, exact: true })).toBeVisible()
    }
    await fallback.getByRole("button", { name: "why is the radio quiet?", exact: true }).click()
    await expect(box).toHaveValue("Why is the radio quiet?")
  })

  test("Agent hand-offs: Overview's Set up with the agent and a layer page's Ask the agent prefill the box, nothing is sent", async ({
    page,
  }) => {
    await openDemo(page)
    await demoMain(page).locator("#needs-you").getByRole("button", { name: "Set up with the agent", exact: true }).click()
    await expectView(page, "/", "Agent")
    const box = agentBox(page)
    await expect(box).toHaveValue("Set up the long-range radio on this node and test it.")
    await expect(box).toBeFocused()
    const banner = demoMain(page).getByText("prepared from: Long-range radio — edit, then send. Nothing is sent until you send it.", { exact: true })
    await expect(banner).toBeVisible()
    // Nothing was sent: the transcript is still the greeting.
    await expect(chatLog(page).getByText(/^You: /)).toHaveCount(0)
    await page.getByRole("button", { name: "Dismiss the prepared-prompt note" }).click()
    await expect(banner).toHaveCount(0)
    await expect(box).toHaveValue("Set up the long-range radio on this node and test it.")

    // A layer page's hand-off replaces the staged text and names the layer.
    await openDemo(page, "#/settings/l3")
    await demoMain(page).getByRole("button", { name: "Ask the agent about Intelligence", exact: true }).click()
    await expectView(page, "/", "Agent")
    await expect(agentBox(page)).toHaveValue("About Layer 3 (Intelligence): what is its state on this node and what should I configure?")
    await expect(demoMain(page).getByText("prepared from: L3 · Intelligence — edit, then send. Nothing is sent until you send it.", { exact: true })).toBeVisible()
    await expect(chatLog(page).getByText(/^You: /)).toHaveCount(0)
  })

  test("header badge: 1 request points at Messages; a fault and its proposal point at Overview's needs-you and focus it", async ({ page }) => {
    await openDemo(page, "#/services/repairs")
    const badge = attentionBadge(page)
    await expect(badge).toHaveAccessibleName("1 item needs you")
    await expect(badge).toHaveAttribute("href", "#/messages")
    await expect(badge).toHaveAttribute("title", "1 message request")
    await expect(badge).toContainText("1")

    await simulateFault(page)
    // The service error and the agent's proposal join the request: the badge now leads to "needs you".
    await expect(badge).toHaveAccessibleName("3 items need you")
    await expect(badge).toHaveAttribute("href", "#/overview#needs-you")
    await expect(badge).toHaveAttribute("title", "1 proposal, 1 service error, 1 message request")
    await badge.click()
    await waitForView(page)
    await expect(page).toHaveURL(/#\/overview#needs-you$/)
    await expect(viewTitle(page)).toHaveText(NODE_NAME)
    await expect(headerTitle(page)).toHaveText("Overview")
    const needs = demoMain(page).locator("section#needs-you")
    await expect(needs).toBeFocused()
    await expect(needs.getByRole("link", { name: REPAIR_PROPOSAL, exact: true })).toBeVisible()
    await expect(needs.getByRole("link", { name: "Messaging", exact: true })).toBeVisible()
    await expect(needs.getByRole("link", { name: "1 message request", exact: true })).toBeVisible()
    // The scroll stayed inside main: the page itself did not move.
    expect(await page.evaluate(() => (document.scrollingElement?.scrollTop ?? 0) + window.scrollY)).toBe(0)

    // Back on Messages via the badge once the fault is the only extra: the request row is the badge's first target again.
    await needs.getByRole("link", { name: "1 message request", exact: true }).click()
    await waitForView(page)
    await expectView(page, "/messages", "Messages")
  })

  test("Proposals: the repair's proposal shows in the Agent view; Accept is two-step and starts Messaging again", async ({ page }) => {
    await openDemo(page, "#/services/repairs")
    await simulateFault(page)
    await expect(navDom(page).getByText("Messaging: ERROR", { exact: true })).toHaveCount(1)

    await clickNavRow(page, "Agent")
    const section = demoMain(page).getByRole("region", { name: "Open proposals" })
    await expect(section).toBeVisible()
    await expect(section.getByText("1 proposal needs you", { exact: true })).toBeVisible()
    const card = proposalCard(page, REPAIR_PROPOSAL)
    await expect(card).toHaveCount(1)
    await expect(card.getByText("demo reply", { exact: true })).toBeVisible()
    await expect(section.getByText("Nothing changes on this node until you accept a proposal.", { exact: true })).toBeVisible()

    // Escape on the confirm cancels it and nothing else happens (the card stays, the drawer stays closed).
    await card.getByRole("button", { name: "Accept", exact: true }).click()
    const confirm = page.getByRole("group", { name: "Confirm: Accept this proposal" })
    await expect(confirm).toBeVisible()
    await expect(confirm.getByRole("button", { name: "No", exact: true })).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(confirm).toHaveCount(0)
    await expect(card.getByRole("button", { name: "Accept", exact: true })).toBeFocused()
    await expect(card).toHaveCount(1)
    if ((await layoutOf(page)) === "drawer") await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false")

    await card.getByRole("button", { name: "Accept", exact: true }).click()
    await confirmYes(page, "Accept this proposal")
    await expect(section).toHaveCount(0)
    // STARTING -> LIVE lands at once under reduced motion; the badge drops the proposal and the error in the same dispatch.
    await expect(navDom(page).getByText("Messaging: LIVE", { exact: true })).toHaveCount(1)
    await expect(attentionBadge(page)).toHaveAccessibleName("1 item needs you")
    await expect(attentionBadge(page)).toHaveAttribute("href", "#/messages")
    // Cross-view: the gate rail on Repairs saw the same approval.
    await clickServiceRow(page, "Repairs")
    await expect(demoMain(page).getByText("applied on this node · messaging is running again", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("APPROVED HERE", { exact: true })).toBeVisible()
  })

  test("Proposals: the chat writes the bridge proposal; unplugging the radio makes Accept refuse with Cannot start yet; Dismiss closes it", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "advanced"), DEMO_MODE_KEY)
    await openDemo(page)
    await setUpRadio(page)
    await clickNavRow(page, "Agent")
    const box = agentBox(page)
    await box.fill("set up my radio")
    await box.press("Enter")
    await expect(chatRow(page, "I wrote a proposal below to start the bridge.")).toHaveCount(1)
    const card = proposalCard(page, BRIDGE_PROPOSAL)
    await expect(card).toHaveCount(1)
    await expect(card.getByText("setup", { exact: true })).toBeVisible()
    await expect(card.getByText(/^Cannot start yet: /)).toHaveCount(0)
    await expect(attentionBadge(page)).toHaveAccessibleName("2 items need you")

    // Why? only stages a question.
    await card.getByRole("button", { name: "Why?", exact: true }).click()
    await expect(box).toHaveValue(`Explain the proposal "${BRIDGE_PROPOSAL}" in plain words: what it changes, the risk, and how to undo it.`)

    // Take the radio away: the proposal's target cannot start any more.
    await clickNavRow(page, "Devices")
    await demoMain(page).getByRole("link", { name: new RegExp(`^${escapeRegExp(BOARD_NAME)}: `) }).click()
    await waitForView(page)
    await page.getByRole("button", { name: "DEMO unplug the radio board" }).click()
    await confirmYes(page, `Unplug ${BOARD_NAME}? The radio stops, and the nodes it heard leave Nearby. Go ahead`)
    await expectView(page, "/devices", "Devices")
    await expect(navDom(page).getByText("Bridge: NOT SET", { exact: true })).toHaveCount(1)

    await clickNavRow(page, "Agent")
    await expect(card).toHaveCount(1)
    await expect(card.getByText("Cannot start yet: Needs a radio.", { exact: true })).toBeVisible()
    await card.getByRole("button", { name: "Accept", exact: true }).click()
    await confirmYes(page, "Accept this proposal")
    // Refused: the card stays open and the shell says why.
    await expect(card).toHaveCount(1)
    await expect(liveRegion(page)).toHaveText("Bridge cannot start yet. Needs a radio.")
    await expect(navDom(page).getByText("Bridge: NOT SET", { exact: true })).toHaveCount(1)

    await card.getByRole("button", { name: "Dismiss", exact: true }).click()
    await confirmYes(page, "Dismiss this proposal")
    await expect(card).toHaveCount(0)
    await expect(chatRow(page, `You dismissed: ${BRIDGE_PROPOSAL}`)).toHaveCount(1)
    await expect(attentionBadge(page)).toHaveAccessibleName("1 item needs you")
  })

  test("Bridge: the board's steps on the page, the role toggle makes it LIVE, DEMO pass a sealed message across", async ({ page }) => {
    await openDemo(page, "#/services/bridge")
    await expectView(page, "/services/bridge", "Bridge")
    await expect(demoMain(page).getByText("Needs a radio.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("No radio board is plugged in. The bridge needs one for its long-range radio side.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("not yet: it needs the radio first", { exact: true })).toBeVisible()
    // The diagram only renders once the bridge can be set up.
    await expect(demoMain(page).getByRole("heading", { name: "How the bridge passes a message" })).toHaveCount(0)

    await page.getByRole("button", { name: "DEMO plug in a radio board" }).click()
    const steps = demoMain(page).getByRole("list", { name: "Radio board steps" })
    await expect(steps.getByRole("listitem").filter({ hasText: "allow once" })).toHaveAttribute("aria-current", "step")
    await expect(demoMain(page).getByRole("heading", { name: "Allow the node to identify the board, once?" })).toBeVisible()
    await page.getByRole("button", { name: "Allow once", exact: true }).click()
    await expect(demoMain(page).getByRole("heading", { name: "This board has no usable firmware." })).toBeVisible()
    await page.getByRole("button", { name: "Flash firmware…" }).click()
    await confirmFlash(page)
    await expect(demoMain(page).getByRole("heading", { name: "Pick your region" })).toBeVisible()
    const setRegion = page.getByRole("button", { name: "Set region" })
    await expect(setRegion).toHaveAttribute("aria-disabled", "true")
    await demoMain(page).getByRole("combobox", { name: "Region", exact: true }).selectOption("Europe")
    await setRegion.click()

    // Ready: the radio is live, the ladder found Network A and the role toggle appears (instant under reduced motion).
    await expect(demoMain(page).getByText("Ready to set up: this laptop has a radio and Wi-Fi that can host a hotspot.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByRole("heading", { name: "Preferred networks, tried in order" })).toBeVisible()
    await expect(demoMain(page).getByText("JOINED Network A", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByRole("list", { name: "Preferred networks in the order they are tried" }).getByRole("listitem").filter({ hasText: "Network A" })).toContainText("FOUND")
    await expect(demoMain(page).getByText(/^Heartbeats started at \d\d:\d\d on Network A\.$/)).toBeVisible()
    await expect(demoMain(page).getByText("yes: a radio plus Wi-Fi that can host a hotspot", { exact: true })).toBeVisible()
    await expect(navDom(page).getByText("Long-range radio: LIVE", { exact: true })).toHaveCount(1)

    const toggle = demoMain(page).getByRole("button", { name: /^Bridge radio and Wi-Fi/ })
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await expect(demoMain(page).getByRole("heading", { name: "How the bridge passes a message" })).toBeVisible()
    await expect(demoMain(page).getByText("Turn the bridge on to pass a message across.", { exact: true })).toBeVisible()
    await expect(toggle).toContainText("OFF")
    await expect(demoMain(page).getByText("Turn it on here, or ask the agent to set it up. It only passes traffic while it is on.", { exact: true })).toBeVisible()
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect(toggle).toContainText("ON")
    await expect(demoMain(page).getByText("Passing sealed traffic between long-range radio and Wi-Fi.", { exact: true })).toBeVisible()
    await expect(navDom(page).getByText("Bridge: LIVE", { exact: true })).toHaveCount(1)

    // The sample crossing: only the outer wrapper changes, the sealed payload keeps its label.
    await expect(demoMain(page).getByText("Turn the bridge on to pass a message across.", { exact: true })).toHaveCount(0)
    await expect(demoMain(page).getByRole("radiogroup", { name: "Direction" }).getByRole("radio", { name: "radio → Wi-Fi" })).toHaveAttribute("aria-checked", "true")
    await page.getByRole("button", { name: "DEMO pass a sealed message across" }).click()
    await expect(demoMain(page).getByText("It leaves over Wi-Fi with the same sealed payload. The bridge never read it.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("outer wrapper: Wi-Fi", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText(new RegExp(`^sealed payload ${LABEL}$`))).toBeVisible()
    await expect(demoMain(page).getByText("· unchanged", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByRole("group", { name: "The two networks and the bridge between them" }).getByText("demo message", { exact: true })).toHaveCount(1)

    // Cross-view: the crossing is an event in Overview's activity.
    await clickNavRow(page, "Overview")
    await expect(demoMain(page).getByRole("log", { name: "activity output" })).toContainText(
      "A sealed message crossed the bridge from long-range radio to Wi-Fi. Only its outer wrapper changed.",
    )
  })

  test("Internet gateway: DEMO connect to the internet makes it LIVE and flushes Bram's queued message", async ({ page }) => {
    await openDemo(page, "#/services/gateway")
    await expect(demoMain(page).getByText("No internet right now. This node becomes a gateway whenever it gets online.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByTestId("gateway-outbox")).toContainText(
      "Messages that need the wider network wait in the outbox until this node gets online again.",
    )

    await page.getByRole("button", { name: "DEMO connect to the internet" }).click()
    await expect(page.getByRole("button", { name: "DEMO drop the internet connection" })).toBeVisible()
    await expect(
      demoMain(page).getByText("The internet is reachable. This node is a gateway for the mesh while it stays online.", { exact: true }),
    ).toBeVisible()
    await expect(demoMain(page).getByTestId("gateway-role")).toContainText("gateway, while it stays online")
    await expect(demoMain(page).getByTestId("gateway-outbox")).toContainText(/Waiting messages left the outbox through the internet at \d\d:\d\d\./)
    await expect(demoMain(page).getByTestId("gateway-outbox")).toContainText("1 waiting message left the outbox through the internet.")

    // Cross-view: Bram's queued message is sent now.
    await goToMessages(page)
    await expect(demoMain(page).getByRole("link", { name: /^Bram\b/ })).not.toContainText("queued")
    await demoMain(page).getByRole("link", { name: /^Bram\b/ }).click()
    await waitForView(page)
    await expect(demoMain(page).getByTestId("msg-m2").locator("[data-state]")).toHaveAttribute("data-state", "sent")
    await expect(demoMain(page).getByTestId("msg-m2")).toContainText(
      "Your hub does not know them, so it cannot hold this for them. Your copy is kept here; it is delivered when you meet directly.",
    )
  })

  test("Storage: DEMO fetch the regional map runs short, frees room and stores the map", async ({ page }) => {
    await openDemo(page, "#/services/storage")
    const gauge = demoMain(page).getByRole("img", { name: /^Store gauge: / })
    await expect(gauge).toHaveAttribute("aria-label", /^Store gauge: room to spare\./)
    await expect(demoMain(page).getByText("regional map: on the hub", { exact: false })).toBeVisible()

    const fetch = page.getByRole("button", { name: "DEMO fetch the regional map" })
    await fetch.click()
    await expect(
      demoMain(page).getByText("The regional map is stored. It is public data you can fetch again, so it is first in line when space runs short.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(gauge).toHaveAttribute("aria-label", /^Store gauge: ran short: room freed\. .*the regional map\. The map went past the line, then room was freed\.$/)
    await expect(demoMain(page).getByText("ran short: room freed", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText(/regional map → freed copies already handed over \(rule 1\)/)).toBeVisible()
    await expect(fetch).toHaveAttribute("aria-disabled", "true")

    // Cross-view: Overview's activity lists the arrival.
    await clickNavRow(page, "Overview")
    await expect(demoMain(page).getByRole("log", { name: "activity output" })).toContainText("The regional map arrived from a hub over Wi-Fi.")
  })

  test("Repairs: simulate a fault, the fix waits at the gate, APPROVE is two-step (Escape cancels), the node is fixed", async ({ page }) => {
    await openDemo(page, "#/services/repairs")
    await expect(demoMain(page).getByText("Nothing to repair right now.", { exact: true })).toBeVisible()
    await expect(navDom(page).getByText("Messaging: LIVE", { exact: true })).toHaveCount(1)

    await page.getByRole("button", { name: "DEMO simulate a fault" }).click()
    // Diagnose -> build -> sandbox land at once under reduced motion; the run then waits for a person.
    await expect(demoMain(page).getByText(`Repair: ${REPAIR_PROPOSAL}`, { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("WAITING FOR YOU", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("Every check passes. Approve it on this node, on the gate rail below.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("Messaging needs a repair.", { exact: true })).toBeVisible()
    await expect(navDom(page).getByText("Messaging: ERROR", { exact: true })).toHaveCount(1)

    const approve = page.getByRole("button", { name: "APPROVE ON THIS NODE", exact: true })
    await expect(approve).not.toHaveAttribute("aria-disabled", "true")
    // The gate rail waits: nothing past station 01 moves by itself.
    await expect(page.getByRole("button", { name: /^next/ })).toHaveCount(0)
    await expect(demoMain(page).getByText("APPROVED HERE", { exact: true })).toBeVisible()

    // The two-step keyboard contract: Escape cancels the question, focus returns to the button, nothing was applied.
    await approve.click()
    const confirm = page.getByRole("group", { name: "Confirm: Apply this fix on this node" })
    await expect(confirm).toBeVisible()
    await expect(confirm.getByRole("button", { name: "No", exact: true })).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(confirm).toHaveCount(0)
    await expect(approve).toBeFocused()
    await expect(demoMain(page).getByText("WAITING FOR YOU", { exact: true })).toBeVisible()
    if ((await layoutOf(page)) === "drawer") await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false")

    await approve.click()
    await confirmYes(page, "Apply this fix on this node")

    await expect(approve).toHaveCount(0)
    await expect(demoMain(page).getByText("applied on this node · messaging is running again", { exact: true })).toBeVisible()
    await expect(navDom(page).getByText("Messaging: LIVE", { exact: true })).toHaveCount(1)
    // 02 passes by itself; 03 MAINTAINERS waits for its button and 04 is not reached.
    const next = page.getByRole("button", { name: /^next\b/ })
    await expect(next).toBeVisible()
    await expect(demoMain(page).getByText("OPEN UPSTREAM", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("not reached", { exact: true })).toHaveCount(4)

    await next.click()
    const owner = page.getByRole("button", { name: "APPROVE AS NODE B'S OWNER", exact: true })
    await expect(owner).toBeVisible()
    await owner.click()
    await confirmYes(page, "Approve it as node B's owner")
    await expect(demoMain(page).getByText(/^\d\d:\d\d · messaging · merged upstream · checked again and approved on node B$/)).toBeVisible()
    await expect(demoMain(page).getByText(REPAIR_PROPOSAL, { exact: true }).first()).toBeVisible()
    await expect(demoMain(page).getByText("No fixes shared yet.", { exact: true })).toHaveCount(0)
  })

  test("Repairs: DEMO try a bad fix is rejected by the sandbox, Build a proper fix recovers, Dismiss and Try again", async ({ page }) => {
    await openDemo(page, "#/services/repairs")
    await simulateFault(page)

    await page.getByRole("button", { name: "DEMO try a bad fix" }).click()
    await expect(demoMain(page).getByText("CLOSED · REJECTED", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("fix rejected: nothing leaves the sandbox", { exact: true }).first()).toBeVisible()
    await expect(demoMain(page).getByText("The messaging stays broken. Nothing was applied, and nothing went upstream.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("other layers: presence went quiet during every restart", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "APPROVE ON THIS NODE", exact: true })).toHaveAttribute("aria-disabled", "true")
    await expect(navDom(page).getByText("Messaging: ERROR", { exact: true })).toHaveCount(1)

    await page.getByRole("button", { name: "Build a proper fix", exact: true }).click()
    await expect(demoMain(page).getByText("WAITING FOR YOU", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("CLOSED · REJECTED", { exact: true })).toHaveCount(0)

    await page.getByRole("button", { name: "Dismiss", exact: true }).click()
    await confirmYes(page, "Dismiss this fix")
    await expect(demoMain(page).getByText("CLOSED · DISMISSED", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("dismissed: nothing was applied, messaging stays broken", { exact: true })).toBeVisible()
    await expect(navDom(page).getByText("Messaging: ERROR", { exact: true })).toHaveCount(1)
    // Dismissed in one place is dismissed everywhere: the Agent view holds no proposal.
    await expect(attentionBadge(page)).toHaveAccessibleName("2 items need you")

    await page.getByRole("button", { name: "Try again", exact: true }).click()
    await expect(demoMain(page).getByText("WAITING FOR YOU", { exact: true })).toBeVisible()
    await expect(attentionBadge(page)).toHaveAccessibleName("3 items need you")
  })

  test("Settings L1: DEMO check for updates runs the trial and ends healthy", async ({ page }) => {
    await openDemo(page, "#/settings/l1")
    await expect(demoMain(page).getByText("This node is up to date.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("No check in this session yet.", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "DEMO check for updates" }).click()
    // checking -> downloaded -> on trial -> healthy land at once under reduced motion.
    await expect(demoMain(page).getByText("The new version passed its trial and is now the running one.", { exact: true })).toBeVisible()
    const steps = demoMain(page).getByRole("list", { name: "Steps of the last update check" })
    await expect(steps).toContainText("healthy")
    await expect(steps.locator("li").filter({ hasText: "trial" })).toContainText("done")
    await expect(demoMain(page).getByText("trial passed: the new version is now running", { exact: false })).toBeVisible()
    await expect(demoMain(page).getByText("the newer version", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("updated: the new version passed its trial", { exact: true })).toBeVisible()

    // Cross-view: Essentials' update row reads the same.
    await openSettingsGroup(page)
    await sidebarNav(page).getByRole("link", { name: "Essentials", exact: true }).click()
    await waitForView(page)
    await expect(demoMain(page).getByText("the newer version", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("updated: the new version passed its trial", { exact: true })).toBeVisible()
  })

  test("Settings L1: DEMO fail the next trial rolls the node back to the previous version", async ({ page }) => {
    await openDemo(page, "#/settings/l1")
    const fail = page.getByRole("button", { name: "DEMO fail the next trial", exact: true })
    await expect(fail).toHaveAttribute("aria-pressed", "false")
    await fail.click()
    await expect(fail).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("button", { name: "DEMO check for updates" }).click()
    await expect(demoMain(page).getByText("Back on the previous version. Nothing else changed.", { exact: true })).toBeVisible()
    const steps = demoMain(page).getByRole("list", { name: "Steps of the last update check" })
    await expect(steps.locator("li").filter({ hasText: "trial" })).toContainText("failed")
    await expect(steps.locator("li").filter({ hasText: "result" })).toContainText("rolled back")
    await expect(demoMain(page).getByText("rolled back: the new version failed its trial", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("the version installed at setup", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByText("a health check failed during the trial", { exact: false })).toBeVisible()
    // The switch is consumed by the trial it failed.
    await expect(fail).toHaveAttribute("aria-pressed", "false")
  })

  test("Settings Essentials: renaming the node changes the Overview h1 and the node chip", async ({ page }) => {
    await openDemo(page, "#/settings")
    const input = page.getByRole("textbox", { name: "Node name" })
    await expect(input).toHaveValue(NODE_NAME)
    const save = demoMain(page).getByRole("button", { name: "Save", exact: true })
    await expect(save).toHaveAttribute("aria-disabled", "true")

    await input.fill("Bench box")
    await expect(save).not.toHaveAttribute("aria-disabled", "true")
    await save.click()
    await expect(demoMain(page).getByText("Saved.", { exact: true })).toBeVisible()
    await expect(liveRegion(page)).toHaveText("Saved.")
    await expect(sidebarPanel(page).getByText("Bench box", { exact: true })).toHaveCount(1)

    await clickNavRow(page, "Overview")
    await expect(viewTitle(page)).toHaveText("Bench box")
    await expect(demoMain(page).getByText(NODE_NAME, { exact: true })).toHaveCount(0)
  })

  test("Settings Essentials: View mode switches the sidebar, Share on this network waits for the two-step Restart", async ({ page }) => {
    await openDemo(page, "#/settings")
    // View mode is the same switch as the sidebar's.
    await demoMain(page).getByRole("radiogroup", { name: "View mode" }).getByRole("radio", { name: "ADVANCED", exact: true }).click()
    await expect(navDom(page).locator('ul[aria-label="Services"] a')).toHaveCount(SERVICES.length)
    await expect.poll(() => savedMode(page)).toBe("advanced")

    const share = demoMain(page).getByRole("button", { name: "Share on this network", exact: true })
    await expect(share).toHaveAttribute("aria-pressed", "false")
    await share.click()
    await expect(share).toHaveAttribute("aria-pressed", "true")
    const pending = demoMain(page).getByText("Sharing on. Restart the node to apply.", { exact: true })
    await expect(pending).toBeVisible()
    await expect(liveRegion(page)).toHaveText("Sharing on. Restart the node to apply.")

    await page.getByRole("button", { name: "Restart node", exact: true }).click()
    const confirm = page.getByRole("group", { name: `Confirm: Restart ${NODE_NAME}` })
    await expect(confirm).toBeVisible()
    await expect(confirm.getByRole("button", { name: "No", exact: true })).toBeFocused()
    await confirm.getByRole("button", { name: "Yes", exact: true }).click()
    // The 2.4 s restart lands at once under reduced motion ("restarting — this page will reconnect" is never observable).
    await expect(demoMain(page).getByText("The node restarted and this page reconnected.", { exact: true })).toBeVisible()
    await expect(pending).toHaveCount(0)

    // Cross-view: Interface (L4) now says the dashboard is shared.
    await openSettingsGroup(page)
    await sidebarNav(page).getByRole("link", { name: "L4 · Interface", exact: true }).click()
    await waitForView(page)
    await expectView(page, "/settings/l4", "Interface", "L4 · Interface")
    await expect(demoMain(page).locator("dl > div").filter({ hasText: "Shared on this network" })).toHaveText(/Shared on this network\s*on$/)
    await expect(demoMain(page).locator("dl > div").filter({ hasText: "Open on" })).toContainText("this laptop and devices on its Wi-Fi")
  })
})

// ------------------------------------------------------------------------------- animated path

test.describe("animated path (no reduced motion)", () => {
  test("Internet gateway: STARTING is observable before LIVE; DEMO drop the internet connection takes it back", async ({ page }) => {
    await openDemo(page, "#/services/gateway")
    await page.getByRole("button", { name: "DEMO connect to the internet" }).click()
    // Real TIMING.startingMs (1.6 s): the role panel reads "checking the internet" first.
    await expect(demoMain(page).getByTestId("gateway-role")).toContainText("checking the internet")
    await expect(demoMain(page).getByText("Checking the internet connection.", { exact: true })).toBeVisible()
    await expect(navDom(page).getByText("Internet gateway: STARTING", { exact: true })).toHaveCount(1)
    await expect(demoMain(page).getByTestId("gateway-role")).toContainText("gateway, while it stays online")
    await expect(navDom(page).getByText("Internet gateway: LIVE", { exact: true })).toHaveCount(1)

    await page.getByRole("button", { name: "DEMO drop the internet connection" }).click()
    await expect(page.getByRole("button", { name: "DEMO connect to the internet" })).toBeVisible()
    await expect(demoMain(page).getByText("No internet right now. This node becomes a gateway whenever it gets online.", { exact: true })).toBeVisible()
    await expect(demoMain(page).getByTestId("gateway-role")).toContainText("mesh node")
    await expect(demoMain(page).getByTestId("gateway-role")).toContainText(/last time \d\d:\d\d to \d\d:\d\d/)
    await expect(demoMain(page).getByRole("log", { name: "gateway output" })).toContainText("internet lost: a pure mesh node again")
    await expect(navDom(page).getByText("Internet gateway: NOT SET", { exact: true })).toHaveCount(1)
  })

  test("Agent: a reply streams (tool lines first, 'Agent is replying'), stop ends it with [stopped]", async ({ page }) => {
    await openDemo(page, "#/")
    await page.getByRole("button", { name: "check this node", exact: true }).click()
    const sendOrStop = demoMain(page).getByRole("button", { name: /^(send|stop)$/ })
    await sendOrStop.click()
    // While it streams the one button reads "stop" and the live bubble carries the sr prefix.
    await expect(sendOrStop).toHaveAccessibleName("stop")
    await expect(chatLog(page).getByText(/^Agent is replying: /)).toBeVisible()
    await expect(liveRegion(page)).toHaveText("agent is replying")
    await expect(chatLog(page).getByRole("listitem").filter({ hasText: /^\[.+\]$/ }).first()).toBeVisible()

    await sendOrStop.click()
    await expect(sendOrStop).toHaveAccessibleName("send")
    await expect(chatLog(page).getByText("[stopped]", { exact: true })).toBeVisible()
    await expect(chatLog(page).getByText(/^Agent is replying: /)).toHaveCount(0)
    await expect(liveRegion(page)).toHaveText("reply stopped")
  })

  test("Nearby: DEMO listen for a minute can be stopped early (the radio set up under reduced motion first)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openDemo(page, "#/nearby")
    await setUpRadio(page)
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await clickNavRow(page, "Nearby")

    const listen = demoMain(page).getByTestId("nearby-listen")
    await listen.getByRole("button", { name: "DEMO listen for a minute" }).click()
    await expect(listen).toContainText(/Listening since 09:0\d\. (Nobody heard yet|Heard so far: .+)\.$/)
    await expect(liveRegion(page)).toHaveText("Listening for a minute.")
    await listen.getByRole("button", { name: "DEMO stop listening" }).click()
    await expect(listen).toContainText(/Last listen, 09:0\d: Stopped listening after \d+ s\. (Nobody was heard|Heard .+)\.$/)
    await expect(listen.getByRole("button", { name: "DEMO listen for a minute" })).toBeVisible()
  })
})

// ----------------------------------------------------------------------------- cookie banner

test.describe("cookie banner on /demo", () => {
  test("renders in flow inside #demo-cookie-slot above the shell; dismissing it gives the shell the room back", async ({ page, viewport }) => {
    // The shared fixture presets a dismissed consent; this test wants the banner, so drop the key again.
    await page.addInitScript((key) => {
      try {
        localStorage.removeItem(key)
      } catch {
        // storage blocked: the banner shows anyway
      }
    }, CONSENT_KEY)
    await openDemo(page)

    const slot = page.locator("#demo-cookie-slot")
    const banner = slot.getByRole("region", { name: "Cookie consent" })
    await expect(banner).toBeVisible()
    await expect(page.getByRole("dialog", { name: "Cookie consent" })).toHaveCount(0)
    await expect(banner).toContainText("strictly necessary cookies")
    expect(await banner.evaluate((el) => getComputedStyle(el).position)).not.toBe("fixed")

    const slotBox = await slot.boundingBox()
    const shellBefore = await shellRoot(page).boundingBox()
    expect(slotBox).not.toBeNull()
    expect(shellBefore).not.toBeNull()
    expect(slotBox?.height ?? 0).toBeGreaterThan(20)
    expect(Math.round(shellBefore?.y ?? 0)).toBeGreaterThanOrEqual(Math.round((slotBox?.y ?? 0) + (slotBox?.height ?? 0)) - 1)
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
    expect(widths.inner).toBe(viewport?.width)
    expect(widths.scroll).toBeLessThanOrEqual(widths.inner)

    await banner.getByRole("button", { name: "Dismiss cookie banner" }).click()
    await expect(banner).toHaveCount(0)
    await expect(slot).toBeEmpty()
    await expect.poll(() => shellRoot(page).evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBeGreaterThan(
      Math.round(shellBefore?.height ?? 0),
    )
    await expect.poll(() => shellRoot(page).evaluate((el) => Math.round(el.getBoundingClientRect().y))).toBeLessThan(Math.round(shellBefore?.y ?? 0))
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY)).toBe("dismissed")
  })
})

// ------------------------------------------------------------------------------- skip, live

test.describe("skip link and live region", () => {
  test("Skip to content focuses #demo-main", async ({ page }) => {
    await openDemo(page)
    const skip = page.getByRole("button", { name: "Skip to content", exact: true })
    await expect(skip).toHaveCount(1)
    await page.keyboard.press("Tab")
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press("Enter")
    await expect(demoMain(page)).toBeFocused()
  })

  test("one live region per shell; it announces a navigation", async ({ page }) => {
    await openDemo(page)
    await expect(liveRegion(page)).toHaveCount(1)
    // The first route of the page load is not news.
    await expect(liveRegion(page)).toHaveText("")
    await goToMessages(page)
    await expect(liveRegion(page)).toHaveText("Opened Messages.")
    await expect(statusLine(shellRoot(page), "Opened Messages.")).toHaveCount(1)
  })
})
