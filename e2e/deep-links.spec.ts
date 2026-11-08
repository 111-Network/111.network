import type { Locator, Page } from "@playwright/test"
import { getLayer, LAYERS, type LayerNumber } from "../src/lib/layers"
import { DEMO_PATH, SITE_URL } from "../src/lib/site"
import { DEMO_MODE_KEY, demoMain, layoutOf, shellRoot, sidebarNav, waitForView } from "./demo-fixtures"
import { expect, openHome, test } from "./fixtures"

// Deep links from the home page into the dashboard demo (plan P5 check: "verify every
// <LayerFooter> link", §6.6 routes, §6.7 CTA band), on a phone (375 px) and a desktop (1280 px).
// Runs against the production build: `pnpm build && pnpm e2e`.
//
// Reduced motion is on for the whole file: in-page scrolls (terminal `goto`, anchors) land at once
// instead of smooth-scrolling, and the demo's own timers fire synchronously. Nothing here depends on
// a demo timer, but under reduced motion the dashboard's busy states (STARTING, "Restarting…",
// "Listening for a minute.") are never observable; this file asserts only on landing headings.
test.use({ reducedMotion: "reduce" })

/** The §6.6 route per layer, pinned here so a drift in src/lib/layers.ts fails loudly. */
const PLAN_ROUTES: readonly string[] = [
  "#/kb",
  "#/settings/l1",
  "#/settings/l2",
  "#/",
  "#/overview",
  "#/messages",
  "#/services/bridge",
  "#/nearby",
  "#/services/storage",
  "#/services/repairs",
]

/** The h1 each deep link lands on (ROUTE_TITLES, LAYER_PAGES titles, the node's name, service names). */
const LANDING_H1: readonly string[] = [
  "Knowledge base",
  "Install & updates",
  "Identity",
  "Agent",
  "Workshop laptop",
  "Messages",
  "Bridge",
  "Nearby",
  "Storage",
  "Repairs",
]

/**
 * The header title of each landing view (selectors.titleFor): the tab reads
 * "<title> · Live demo · 111 Network". Layer pages are "L<n> · <title>"; Overview is "Overview",
 * not the node's name.
 */
const LANDING_TITLE: readonly string[] = [
  "Knowledge base",
  "L1 · Install & updates",
  "L2 · Identity",
  "Agent",
  "Overview",
  "Messages",
  "Bridge",
  "Nearby",
  "Storage",
  "Repairs",
]

/** Layers whose demo view is a service page: the shell switches to ADVANCED for them. */
const SERVICE_LAYERS: ReadonlySet<number> = new Set([6, 8, 9])

/** The seeded state of each service page's sidebar row (engine/world.ts: bridge unset, storage and repairs live). */
const SERVICE_STATE: Readonly<Record<string, string>> = {
  Bridge: "NOT SET",
  Storage: "LIVE",
  Repairs: "LIVE",
}

const section = (page: Page, n: number): Locator => page.locator(`section#layer-${n}`)
const terminal = (page: Page): Locator => page.getByRole("region", { name: "111 Network demo terminal" })
/** The terminal's scrolling output (the body that holds the prompt), without its live region. */
const output = (page: Page): Locator => terminal(page).locator("div:has(> form)")
/** The sidebar nav of the standalone /demo (hidden inside the drawer on a phone: a CSS locator, so hidden rows still count). */
const mainNav = (page: Page): Locator => page.locator('[data-demo-shell] nav[aria-label="Main"]')
/** The /demo site bar's logo link, back to the home page. */
const demoLogo = (page: Page): Locator => page.getByRole("link", { name: "111.network, back to the home page", exact: true })

/** The landing h1 of the current demo view (expectLanding checks there is exactly one). */
const viewTitle = (page: Page): Locator => demoMain(page).locator("h1")

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** The demo link of layer `n` on the home page: the LayerFooter, or Layer 4's bold button. */
function layerDemoLink(page: Page, n: LayerNumber): Locator {
  // The footer's name is "see it in the dashboard" + the sr-only ": <title>" (the arrow is aria-hidden).
  return n === 4
    ? section(page, n).getByRole("link", { name: "Open the full dashboard demo", exact: true })
    : section(page, n).getByRole("link", { name: `see it in the dashboard : ${getLayer(n).title}`, exact: true })
}

/** Instant scroll so a section (and its lazy, in-view mounted islands) is on screen. */
async function scrollTo(target: Locator): Promise<void> {
  await target.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }))
  await expect(target).toBeInViewport()
}

/** Type one command into the finale terminal and press Enter. */
async function run(page: Page, command: string): Promise<void> {
  const input = terminal(page).getByRole("textbox", { name: "Command" })
  await input.fill(command)
  await input.press("Enter")
}

/** The saved SIMPLE | ADVANCED mode, as the next page load would read it. */
async function savedMode(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), DEMO_MODE_KEY)
}

/** Preset the saved mode before the first navigation of the test. */
async function presetMode(page: Page, mode: "simple" | "advanced"): Promise<void> {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [DEMO_MODE_KEY, mode])
}

/** On a phone the /demo sidebar is the drawer: MENU opens it so its rows and the mode switch are on screen. */
async function openSidebar(page: Page): Promise<void> {
  if ((await layoutOf(page)) === "drawer") {
    await page.getByRole("button", { name: "MENU", exact: true }).click()
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible()
  }
}

/** The mode switch has `mode` checked and the other one unchecked. */
async function expectMode(page: Page, mode: "SIMPLE" | "ADVANCED"): Promise<void> {
  const group = page.getByRole("radiogroup", { name: "Interface mode" })
  await expect(group.getByRole("radio", { name: mode, exact: true })).toHaveAttribute("aria-checked", "true")
  await expect(group.getByRole("radio", { name: mode === "SIMPLE" ? "ADVANCED" : "SIMPLE", exact: true })).toHaveAttribute(
    "aria-checked",
    "false",
  )
}

/**
 * The demo has landed on a view: a measured shell, the right hash, exactly one h1 in main, and the
 * tab title that the shell's title effect writes (and re-asserts through a MutationObserver when the
 * page <title> hydrates after the island: a deep link is exactly the case that triggers that path).
 */
async function expectLanding(page: Page, baseURL: string, hash: string, h1: string, title: string): Promise<void> {
  await expect(page).toHaveURL(`${baseURL}${DEMO_PATH}${hash}`)
  await waitForView(page)
  await expect(viewTitle(page)).toHaveCount(1)
  await expect(viewTitle(page)).toHaveText(h1)
  await expect(page).toHaveTitle(`${title} · Live demo · 111 Network`)
}

/**
 * A service deep link switched the shell to ADVANCED and marks that service's sidebar row current.
 * The saved mode key is NOT rewritten by this first-route switch (engine/react.tsx captures the
 * mode after start() and persists only later changes), so the caller's preset "simple" survives.
 */
async function expectAdvancedService(page: Page, serviceName: string): Promise<void> {
  await openSidebar(page)
  await expectMode(page, "ADVANCED")

  const nav = sidebarNav(page)
  const current = nav.locator('a[aria-current="page"]')
  await expect(current).toHaveCount(1)
  // Service rows are named by their status dot: "Bridge: NOT SET", "Storage: LIVE".
  await expect(current).toHaveAccessibleName(`${serviceName}: ${SERVICE_STATE[serviceName]}`)
  // The row is in the services group, which exists only in ADVANCED mode.
  await expect(nav.getByRole("list", { name: "Services", exact: true }).locator('a[aria-current="page"]')).toHaveCount(1)

  expect(await savedMode(page)).toBe("simple")
}

test.describe("layer footers: home -> /demo and back", () => {
  for (const layer of LAYERS) {
    const n = layer.n
    const h1 = LANDING_H1[n]
    const service = SERVICE_LAYERS.has(n)

    test(`Layer ${n} (${layer.title}) lands on "${h1}"${service ? " in ADVANCED mode" : ""}`, async ({
      page,
      baseURL,
    }) => {
      expect(layer.demoHash).toBe(PLAN_ROUTES[n])
      // A saved SIMPLE must never hide a service page the link points at.
      if (service) await presetMode(page, "simple")

      await openHome(page)
      await scrollTo(section(page, n))

      const link = layerDemoLink(page, n)
      await expect(link).toHaveAttribute("href", layer.demoHref)
      await link.click()

      await expectLanding(page, baseURL ?? "", layer.demoHash, h1, LANDING_TITLE[n])
      if (service) await expectAdvancedService(page, h1)

      // Back: the home page again, at the section the link was in.
      await page.goBack()
      await expect(page).toHaveURL(new RegExp(`^${escapeRegExp(baseURL ?? "")}/(#layer-${n})?$`))
      await expect(page.locator('header button[aria-haspopup="dialog"][aria-controls]')).toHaveCount(1)
      await expect(section(page, n)).toBeInViewport()
    })
  }

  test("the demo's logo link goes home, and a service page's ADVANCED does not leak into the next hop", async ({
    page,
    baseURL,
  }) => {
    await openHome(page)
    await scrollTo(section(page, 9))
    await layerDemoLink(page, 9).click()
    await expectLanding(page, baseURL ?? "", "#/services/repairs", "Repairs", "Repairs")
    await openSidebar(page)
    await expectMode(page, "ADVANCED")
    // The first-route switch is for this page load only: nothing was saved.
    expect(await savedMode(page)).toBeNull()

    // The demo's own way back: the site bar logo.
    await expect(demoLogo(page)).toHaveAttribute("href", "/")
    await demoLogo(page).click()
    await expect(page).toHaveURL(`${baseURL}/`)
    await expect(page.locator('header button[aria-haspopup="dialog"][aria-controls]')).toHaveCount(1)

    // Home -> demo again, at a non-service view: a fresh store in SIMPLE, with no Services list.
    await scrollTo(section(page, 0))
    await layerDemoLink(page, 0).click()
    await expectLanding(page, baseURL ?? "", "#/kb", "Knowledge base", "Knowledge base")
    await expect(mainNav(page).locator('ul[aria-label="Services"]')).toHaveCount(0)
    await openSidebar(page)
    await expectMode(page, "SIMPLE")
    // (The Knowledge base has no sidebar row of its own, in either mode: it is reached from Overview.)
    expect(await savedMode(page)).toBeNull()
  })

  test("the demo's INSTALL control leads to the hero's install box", async ({ page, baseURL, isMobile }) => {
    await openHome(page)
    await scrollTo(section(page, 7))
    await layerDemoLink(page, 7).click()
    await expectLanding(page, baseURL ?? "", "#/nearby", "Nearby", "Nearby")

    const site = page.getByRole("navigation", { name: "Site" })
    if (isMobile) {
      // Below lg: a plain link to the home page's install box.
      const install = site.getByRole("link", { name: "INSTALL", exact: true })
      await expect(install).toHaveAttribute("href", "/#install")
      await install.click()
      await expect(page).toHaveURL(`${baseURL}/#install`)
      await expect(page.locator("#install")).toBeInViewport()
    } else {
      // At lg and up: the home nav's install popover, loaded after hydration.
      await site.getByRole("button", { name: "INSTALL", exact: true }).click()
      await expect(page.getByRole("dialog", { name: "Install" })).toBeVisible()
      await expect(page).toHaveURL(`${baseURL}${DEMO_PATH}#/nearby`)
    }
  })
})

test.describe("CTA band: Now open the node.", () => {
  const band = (page: Page): Locator => page.getByRole("region", { name: "Now open the node." })
  const cells = (page: Page): Locator => band(page).getByRole("list", { name: "Open the demo at a layer" }).getByRole("link")
  const openDemo = (page: Page): Locator => band(page).getByRole("link", { name: "Open the demo", exact: true })

  test("the ten cells link to the §6.6 routes, in layer order", async ({ page }) => {
    await openHome(page)
    await scrollTo(band(page))

    await expect(band(page).getByText("Interactive demo", { exact: true })).toBeVisible()
    await expect(band(page).getByRole("heading", { level: 2, name: "Now open the node." })).toBeVisible()
    await expect(
      band(page).getByText("An interactive copy of the dashboard, with every layer in it. Sample data, and nothing leaves the page.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(openDemo(page)).toHaveAttribute("href", `${DEMO_PATH}#/overview`)
    await expect(band(page).getByRole("link", { name: "or install it" })).toHaveAttribute("href", "#install")

    await expect(cells(page)).toHaveCount(10)
    const hrefs = await cells(page).evaluateAll((els) => els.map((el) => el.getAttribute("href")))
    expect(hrefs).toEqual(PLAN_ROUTES.map((hash) => `${DEMO_PATH}${hash}`))
    expect(hrefs).toEqual(LAYERS.map((layer) => layer.demoHref))

    const labels = await cells(page).evaluateAll((els) => els.map((el) => el.textContent ?? ""))
    for (const layer of LAYERS) {
      expect(labels[layer.n]).toContain(layer.ghost)
      expect(labels[layer.n]).toContain(layer.navLabel)
      expect(labels[layer.n]).toContain(`: open ${layer.title} in the demo`)
    }
  })

  test("02 IDENTITY opens the Identity settings page", async ({ page, baseURL }) => {
    await openHome(page)
    await scrollTo(band(page))

    await cells(page).nth(2).click()
    await expectLanding(page, baseURL ?? "", getLayer(2).demoHash, "Identity", "L2 · Identity")
    // A settings layer page needs no mode switch, and nothing is saved until the visitor changes the mode.
    expect(await savedMode(page)).toBeNull()
    await expect(mainNav(page).locator('a[aria-current="page"]')).toContainText("L2 · Identity")
  })

  test("08 STORAGE opens the Storage service page in ADVANCED mode", async ({ page, baseURL }) => {
    await presetMode(page, "simple")
    await openHome(page)
    await scrollTo(band(page))

    await cells(page).nth(8).click()
    await expectLanding(page, baseURL ?? "", getLayer(8).demoHash, "Storage", "Storage")
    await expectAdvancedService(page, "Storage")
  })

  test("Open the demo -> lands on Overview", async ({ page, baseURL }) => {
    await openHome(page)
    await scrollTo(band(page))

    await openDemo(page).click()
    await expectLanding(page, baseURL ?? "", "#/overview", "Workshop laptop", "Overview")
    await expect(mainNav(page).locator('a[aria-current="page"]')).toHaveText(/overview/i)
  })
})

test.describe("site chrome: nav and footer", () => {
  test("the DEMO nav link opens the demo at Overview", async ({ page, baseURL, isMobile }) => {
    await openHome(page)

    if (isMobile) {
      // Below lg the link sits in the MENU sheet.
      await page.getByRole("button", { name: "MENU", exact: true }).click()
      const sheet = page.getByRole("dialog", { name: "Menu" })
      await expect(sheet).toBeVisible()
      const link = sheet.getByRole("link", { name: "DEMO", exact: true })
      await expect(link).toHaveAttribute("href", DEMO_PATH)
      await link.click()
    } else {
      const link = page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "DEMO", exact: true })
      await expect(link).toHaveAttribute("href", DEMO_PATH)
      await link.click()
    }

    // A bare /demo normalises to #/overview in place (replaceState).
    await expectLanding(page, baseURL ?? "", "#/overview", "Workshop laptop", "Overview")
    // The standalone shell's sidebar nav is "Main" (a CSS locator: on a phone it waits inside the closed drawer),
    // and its view host is the page's <main>, not the embedded window's region.
    await expect(shellRoot(page).locator('nav[aria-label="Main"]')).toHaveCount(1)
    await expect(demoMain(page)).toHaveRole("main")
  })

  test("the footer's Demo link opens the demo", async ({ page, baseURL }) => {
    await openHome(page)
    const explore = page.getByRole("navigation", { name: "Explore" })
    await scrollTo(explore)

    const link = explore.getByRole("link", { name: "Demo", exact: true })
    await expect(link).toHaveAttribute("href", DEMO_PATH)
    await link.click()

    await expectLanding(page, baseURL ?? "", "#/overview", "Workshop laptop", "Overview")
  })
})

test.describe("finale terminal", () => {
  test("`demo` prints the demo link, and it opens Overview", async ({ page, baseURL }) => {
    await openHome(page)
    const out = output(page)
    await expect(out).toContainText("111 Network demo terminal. Type help.")

    await run(page, "demo")
    await expect(out.getByText(`The interactive dashboard demo, with sample data: ${DEMO_PATH}`)).toBeVisible()
    const link = out.getByRole("link", { name: "open the demo" })
    await expect(link).toHaveAttribute("href", DEMO_PATH)
    await expect(link).toHaveText("open the demo ->")

    await link.click()
    await expectLanding(page, baseURL ?? "", "#/overview", "Workshop laptop", "Overview")
  })

  test("`goto 6` scrolls to Layer 6 and writes #layer-6", async ({ page }) => {
    await openHome(page)
    const out = output(page)
    await expect(out).toContainText("111 Network demo terminal. Type help.")
    await expect(page).not.toHaveURL(/#layer-6$/)

    await run(page, "goto 6")
    await expect(page).toHaveURL(/#layer-6$/)
    await expect(page.locator("#layer-6-title")).toBeInViewport()
    await expect(section(page, 6)).toBeFocused()

    // The output stays behind, with the jump line and the in-page link.
    await expect(out.getByText(`jumping to Layer 6 · ${getLayer(6).title}`)).toBeAttached()
    await expect(out.getByRole("link", { name: `Go to Layer 6: ${getLayer(6).title}` })).toHaveAttribute("href", "#layer-6")
    // Still the home page: the terminal never opens the demo on its own.
    expect(new URL(page.url()).pathname).toBe("/")
  })
})

test.describe("Layer 4: the embedded node window", () => {
  const nodeWindow = (page: Page): Locator => page.locator('#layer-4 [data-demo-shell][data-layout="rail"]')

  test("the real shell mounts in view as a region with its own nav, no MENU and headings from h3", async ({ page }) => {
    await openHome(page)
    await scrollTo(section(page, 4))

    // Lazy: next/dynamic (ssr: false) loads the shell once the frame is within 400 px of the viewport.
    const win = nodeWindow(page)
    await expect(win).toHaveCount(1, { timeout: 15_000 })
    await expect(win.getByRole("heading", { level: 3, name: "Workshop laptop" })).toBeVisible({ timeout: 15_000 })

    await expect(win.getByRole("navigation", { name: "Dashboard" })).toBeVisible()
    await expect(win.getByRole("navigation", { name: "Main" })).toHaveCount(0)
    await expect(win.getByRole("region", { name: "Dashboard demo" })).toHaveCount(1)
    await expect(win.locator("main")).toHaveCount(0)
    await expect(win.getByRole("button", { name: "MENU", exact: true })).toHaveCount(0)

    // Under the home page's h1 and the section's h2, nothing inside the window may outrank h3.
    await expect(win.locator("h1, h2")).toHaveCount(0)

    // The home page keeps exactly one h1 of its own.
    await expect(page.locator("h1")).toHaveCount(1)

    const cta = section(page, 4).getByRole("link", { name: "Open the full dashboard demo", exact: true })
    await expect(cta).toHaveAttribute("href", `${DEMO_PATH}#/overview`)
    await expect(cta).toHaveAttribute("href", getLayer(4).demoHref)
  })

  test("a rail glyph navigates inside the window: no hash route, same tab title; a modified click opens the full demo", async ({
    page,
    context,
    baseURL,
  }) => {
    await openHome(page)
    await scrollTo(section(page, 4))
    const win = nodeWindow(page)
    await expect(win.getByRole("heading", { level: 3, name: "Workshop laptop" })).toBeVisible({ timeout: 15_000 })

    const urlBefore = page.url()
    const titleBefore = await page.title()
    expect(new URL(urlBefore).hash).not.toMatch(/^#\//)

    const nearby = win.getByRole("navigation", { name: "Dashboard" }).getByRole("link", { name: "Nearby", exact: true })
    // The memory router still writes a real href, so a modified click or a new tab opens the full demo there.
    await expect(nearby).toHaveAttribute("href", `${DEMO_PATH}#/nearby`)
    await nearby.click()

    await expect(win.getByRole("heading", { level: 3, name: "Nearby" })).toBeVisible()
    await expect(win.getByRole("heading", { level: 3, name: "Workshop laptop" })).toHaveCount(0)
    await expect(nearby).toHaveAttribute("aria-current", "page")
    await expect(win.locator("h1, h2")).toHaveCount(0)

    // Nothing leaves the window: the page's URL and title are untouched.
    expect(page.url()).toBe(urlBefore)
    expect(await page.title()).toBe(titleBefore)
    expect(new URL(page.url()).pathname).toBe("/")

    // DemoLink lets a modified click through to the browser: a new tab at the full demo, this page untouched.
    const [popup] = await Promise.all([context.waitForEvent("page"), nearby.click({ modifiers: ["ControlOrMeta"] })])
    await expect(popup).toHaveURL(`${baseURL}${DEMO_PATH}#/nearby`)
    await expect(popup.locator("#demo-main h1")).toHaveText("Nearby")
    await popup.close()
    expect(page.url()).toBe(urlBefore)
    await expect(win.getByRole("heading", { level: 3, name: "Nearby" })).toBeVisible()
  })
})

test.describe("sitemap", () => {
  test("lists / and /demo, and no hash routes", async ({ page }) => {
    const response = await page.request.get("/sitemap.xml")
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toMatch(/xml/)

    const xml = await response.text()
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs).toEqual([`${SITE_URL}/`, `${SITE_URL}${DEMO_PATH}`])
    expect(xml).not.toContain("#/")
    expect(xml).not.toContain("#layer-")
  })
})
