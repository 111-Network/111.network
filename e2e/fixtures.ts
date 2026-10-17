import { test as base, expect, type Locator, type Page } from "@playwright/test"

// Shared setup for the home smoke tests.
//
// - The cookie banner is a fixed box over the bottom-left corner; a stored
//   choice keeps it closed so it never sits on top of a control we click.
// - The analytics script is served by the production host only; on a local
//   `next start` it 404s, which the browser logs as a console error. Answer
//   it with an empty script so the console check sees only the site's own errors.
// - Every test fails if the page logged a console error, an uncaught error or
//   any hydration message while it ran (React reports hydration mismatches
//   through console.error in production).

const CONSENT_KEY = "111-cookie-consent"

export interface HomeFixtures {
  /** Console errors, page errors and hydration messages seen so far in this test. */
  consoleProblems: string[]
}

export const test = base.extend<HomeFixtures>({
  page: async ({ page }, provide) => {
    await page.addInitScript((key) => {
      try {
        window.localStorage.setItem(key, "dismissed")
      } catch {
        // Storage blocked: the banner then shows, and the tests still scroll past it.
      }
    }, CONSENT_KEY)
    await page.route("**/_vercel/insights/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
    )
    await provide(page)
  },

  consoleProblems: [
    async ({ page }, provide) => {
      const problems: string[] = []
      page.on("console", (message) => {
        const text = message.text()
        if (message.type() === "error" || /hydrat/i.test(text)) problems.push(`console.${message.type()}: ${text}`)
      })
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`))
      await provide(problems)
      expect(problems, "console errors, page errors or hydration messages").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/**
 * Open the home page and wait until the client has taken over: the nav swaps
 * its server-rendered overlay placeholder (INSTALL at lg and up, MENU below)
 * for the real trigger, which carries aria-controls. That happens only after
 * the whole page has hydrated, so clicks and typing reach React from here on.
 */
export async function openHome(page: Page, path = "/"): Promise<void> {
  await page.goto(path)
  await expect(page.locator('header button[aria-haspopup="dialog"][aria-controls]')).toHaveCount(1)
}

/** Resolve after the browser has painted two more frames. */
export async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

/** One step of a scroll walk: where the page was and how wide its content was. */
export interface ScrollStep {
  y: number
  scrollWidth: number
  innerWidth: number
  /** Elements whose right edge passes the viewport (only when the page overflows). */
  offenders: string[]
}

/**
 * Walk the page from the top to the bottom in viewport-sized steps (instant
 * jumps, two frames each, so in-view islands mount and start), recording the
 * page width at every step. Ends at the very bottom.
 */
export async function scrollThrough(page: Page): Promise<ScrollStep[]> {
  return page.evaluate(async () => {
    const frame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : ""
      const cls = typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 4).join(".")}` : ""
      return `${el.tagName.toLowerCase()}${id}${cls}`
    }
    const steps: ScrollStep[] = []
    let y = 0
    for (;;) {
      window.scrollTo({ top: y, behavior: "instant" })
      await frame()
      const root = document.documentElement
      const offenders =
        root.scrollWidth > window.innerWidth
          ? [...document.body.querySelectorAll("*")]
              .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
              .slice(0, 10)
              .map(describe)
          : []
      steps.push({ y, scrollWidth: root.scrollWidth, innerWidth: window.innerWidth, offenders })
      const max = root.scrollHeight - window.innerHeight
      if (y >= max) break
      y = Math.min(y + Math.round(window.innerHeight * 0.75), max)
    }
    return steps
  })
}

/** The polite live line (role=status) inside `scope` whose text matches. */
export function statusLine(scope: Locator, text: string | RegExp): Locator {
  return scope.getByRole("status").filter({ hasText: text })
}
