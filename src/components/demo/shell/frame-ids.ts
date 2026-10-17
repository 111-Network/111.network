// Fixed element ids shared by the /demo page (a Server Component), its client island and the cookie
// banner. Plain constants in a React-free module: a constant exported from a "use client" file would
// reach a Server Component as a client reference, not as its value.

/** The shell's main area on /demo; the page's skip button moves focus here. */
export const DEMO_MAIN_ID = "demo-main"

/**
 * An empty, in-flow slot between the DEMO strip and the dashboard. On /demo the cookie banner renders
 * into it (a portal) instead of floating over the dashboard, so it pushes the shell down while it is
 * open and never covers it.
 */
export const DEMO_COOKIE_SLOT_ID = "demo-cookie-slot"
