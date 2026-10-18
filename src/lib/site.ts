/** Canonical site origin, no trailing slash (env override for previews). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://111.network"

/** Brand name as printed in titles and metadata. */
export const SITE_NAME = "111 Network"
/** Hero title / metadata tagline (W11: unchanged). */
export const SITE_TAGLINE = "Free, Secure Communication for Everyone"
/** Hero subtitle and every meta description (plan §3.1, verbatim). */
export const SITE_DESCRIPTION =
  "A message network that runs on people, not servers. Any device becomes a node, joins the mesh networks that already exist, and a local AI keeps it running. No company. No government. Just you and the world."
/** GitHub organisation page (W8). */
export const GITHUB_URL = "https://github.com/111-Network"
/** Date shown on /terms. */
export const TERMS_LAST_UPDATED = "2026-10-17"

/** The one version string, rendered everywhere it appears (W9). */
export const SITE_VERSION = "V.0.0.6 Experimental"

/** Where the installer script will be served from. */
export const INSTALL_URL = "https://install.111.network/install.sh"
/** Exact copyable install commands (W10); never alter these strings for display. */
export const INSTALL_COMMANDS = {
  host: "curl -fsSL https://install.111.network/install.sh | sh",
  phone: "curl -fsSL https://install.111.network/install.sh | sh -s -- --phone",
} as const
/** Which install command: this machine ("host") or an attached phone ("phone"). */
export type InstallTarget = keyof typeof INSTALL_COMMANDS
/** False until INSTALL_URL actually serves the script (plan §3.3). `pnpm check:install` HEADs it once true. */
export const INSTALL_LIVE: boolean = false
/** Readable source of the installer shim ("READ IT FIRST ->" while INSTALL_LIVE is false). */
export const INSTALL_SCRIPT_SOURCE =
  "https://github.com/111-Network/os/blob/main/10-bootstrap/shim/install.sh"
/** Where "READ IT FIRST ->" points: the served script once live, the GitHub source until then. */
export const INSTALL_READ_FIRST_URL: string = INSTALL_LIVE ? INSTALL_URL : INSTALL_SCRIPT_SOURCE

/**
 * Install-card copy shared by the hero terminal, the nav popover and the
 * finale terminal's `install` / `phone` / `sudo` commands (plan §3, §4.4).
 */
export const INSTALL_NOTES = {
  /** Under the command, always. */
  user: "Run as your normal user. Never put sudo in front.",
  /** The finale terminal's answer to `sudo …`. */
  sudo: "never put sudo in front",
  /** Extra line while INSTALL_LIVE is false. */
  prerelease: "installer publishes with the first release",
  /** The plain tags before the source link, in order. */
  tags: ["RE-RUN SAFE", "NO TELEMETRY"],
  /** Link text to INSTALL_READ_FIRST_URL. */
  readFirst: "READ IT FIRST ->",
} as const

/** One line of a simulated install run; `ok` lines end in a dot leader + "[ok]". */
export interface InstallRunLine {
  text: string
  ok?: boolean
}

/**
 * The typed install run after each command, in plain words (plan §3, §3.3).
 * Retype it on tab switch or COPY; the last line gets the blinking cursor.
 */
export const INSTALL_RUN: Readonly<Record<InstallTarget, readonly InstallRunLine[]>> = {
  host: [
    { text: "reading hardware", ok: true },
    { text: "this laptop can run a small AI locally" },
    { text: "identity made on this device", ok: true },
    { text: "installing only what it needs", ok: true },
    { text: "node online · dashboard ready" },
  ],
  phone: [
    { text: "plug the phone in over USB-C" },
    { text: "the installer shows each tap only you can make" },
    { text: "phone online · dashboard ready" },
  ],
}

/**
 * Page anchors other than the layer sections (those are layer.id from layers.ts).
 * Link with `#${ANCHORS.install}`; the element with the id adds `scroll-mt-nav`.
 */
export const ANCHORS = {
  /** <main id="main"> in page.tsx (skip link target). */
  main: "main",
  /** The hero install terminal (nav INSTALL on mobile, footer, CTA band). */
  install: "install",
  /** The finale terminal (nav TERMINAL, footer). */
  terminal: "terminal",
} as const

/** The 111 block logo (footer, terminal `ascii`). Box drawing + full blocks only: all in Geist Mono. */
export const ASCII_LOGO = [
  " ██╗   ██╗   ██╗",
  "███║  ███║  ███║",
  "╚██║  ╚██║  ╚██║",
  " ██║   ██║   ██║",
  " ██║   ██║   ██║",
  " ╚═╝   ╚═╝   ╚═╝",
].join("\n")

/** Route of the interactive dashboard demo. */
export const DEMO_PATH = "/demo"
/** True since P5 (2026-10-17): /demo is live; gates every link to the demo. */
export const DEMO_READY: boolean = true
