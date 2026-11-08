import { expect, type Locator, type Page } from "@playwright/test"

// Shared helpers for the /demo dashboard tests (demo.spec.ts, deep-links.spec.ts).
//
// The dashboard is one client island. The server render has an EMPTY main
// (the hash route cannot be read on the server), and the shell root carries
// `data-layout="unknown"` until a ResizeObserver has measured it. A view is
// on screen once the root has a real layout AND main holds the view's h1
// (every view but not-found renders one). Demo timers run on real
// setTimeout; under `reducedMotion: "reduce"` every step lands at once.

/** localStorage key of the SIMPLE | ADVANCED mode ("simple" | "advanced"). */
export const DEMO_MODE_KEY = "111.demo.mode"

/** The shell root, once measured (docked | rail | drawer). */
export function shellRoot(page: Page): Locator {
  return page.locator('[data-demo-shell]:not([data-layout="unknown"])')
}

/** The dashboard's scroll container and view host. */
export function demoMain(page: Page): Locator {
  return page.locator("#demo-main")
}

/**
 * Open `/demo` at a hash route (e.g. "#/messages"; "" opens Overview) and wait
 * until the client has taken over and the view has rendered its heading.
 */
export async function openDemo(page: Page, hash = ""): Promise<void> {
  await page.goto(`/demo${hash}`)
  await waitForView(page)
}

/** Wait for a measured shell and a rendered view heading in main. */
export async function waitForView(page: Page): Promise<void> {
  await expect(shellRoot(page)).toHaveCount(1)
  await expect(demoMain(page).locator("h1").first()).toBeVisible()
}

/** The route part of the current URL: "/demo#/kb" -> "/kb"; no hash -> "". */
export async function currentHashRoute(page: Page): Promise<string> {
  return page.evaluate(() => window.location.hash.replace(/^#/, ""))
}

/** The current shell layout: "docked" | "rail" | "drawer". */
export async function layoutOf(page: Page): Promise<string> {
  return (await shellRoot(page).getAttribute("data-layout")) ?? ""
}

/** The sidebar navigation landmark ("Main" on /demo, "Dashboard" inside the Layer 4 window). */
export function sidebarNav(page: Page, scope: Locator | Page = page): Locator {
  return scope.getByRole("navigation", { name: /^(Main|Dashboard)$/ })
}

/**
 * Click a sidebar page row by its visible label (e.g. "Messages"). In the
 * drawer layout the MENU button opens the drawer first; navigating closes it.
 */
export async function clickNavRow(page: Page, label: string): Promise<void> {
  if ((await layoutOf(page)) === "drawer") {
    const menu = page.getByRole("button", { name: "MENU", exact: true })
    if ((await menu.getAttribute("aria-expanded")) !== "true") await menu.click()
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible()
  }
  await sidebarNav(page).getByRole("link", { name: label, exact: true }).click()
  await waitForView(page)
}

/** The polite live line (role=status) inside `scope` whose text matches. */
export function statusLine(scope: Locator, text: string | RegExp): Locator {
  return scope.getByRole("status").filter({ hasText: text })
}
