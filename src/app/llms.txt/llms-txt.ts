import { LAYERS } from "@/lib/layers"
import {
  DEMO_PATH,
  DEMO_READY,
  GITHUB_URL,
  INSTALL_COMMANDS,
  INSTALL_LIVE,
  INSTALL_NOTES,
  INSTALL_READ_FIRST_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  SITE_VERSION,
} from "@/lib/site"

// Body of /llms.txt (plan §4.6), rendered from the same constants as the
// page, so the version, the layers and the install state never drift.
// React-free; route.ts serves it as static text.

/** Switches that change what /llms.txt says; default to the live site.ts flags. */
export interface LlmsTxtOptions {
  /** INSTALL_LIVE: false adds the pre-release note. */
  installLive?: boolean
  /** DEMO_READY: true adds the /demo line. */
  demoReady?: boolean
  /** Where "read it first" points (INSTALL_READ_FIRST_URL). */
  readFirstUrl?: string
}

/** The /llms.txt document (Markdown-style plain text, ends with a newline). */
export function renderLlmsTxt({
  installLive = INSTALL_LIVE,
  demoReady = DEMO_READY,
  readFirstUrl = INSTALL_READ_FIRST_URL,
}: LlmsTxtOptions = {}): string {
  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_TAGLINE}. ${SITE_DESCRIPTION}`,
    "",
    `Current release: ${SITE_VERSION}.`,
    "",
    `${SITE_NAME} is built as ten layers, and each device runs only the layers it can.`,
    "",
    "## The ten layers",
    "",
    ...LAYERS.map((layer) => `- [${layer.ghost} ${layer.title}](${SITE_URL}/#${layer.id}): ${layer.subtitle}. ${layer.description}`),
    "",
    "## Install",
    "",
    INSTALL_NOTES.user,
    "",
    `- This machine: \`${INSTALL_COMMANDS.host}\``,
    `- An attached phone, over USB-C: \`${INSTALL_COMMANDS.phone}\``,
    ...(installLive ? [] : [`- Pre-release: ${INSTALL_NOTES.prerelease}.`]),
    `- Read it first: ${readFirstUrl}`,
    "",
    "## Links",
    "",
    `- [Homepage](${SITE_URL}/)`,
    ...(demoReady
      ? [
          `- [Demo](${SITE_URL}${DEMO_PATH}): An interactive copy of the dashboard, with every layer in it. Sample data, and nothing leaves the page.`,
        ]
      : []),
    `- [GitHub](${GITHUB_URL})`,
    `- [Terms of Service](${SITE_URL}/terms)`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    "",
    "## Brand",
    "",
    `- Tagline: ${SITE_TAGLINE}`,
    "- Principle: Built by people, not providers",
    "- Aesthetic: monochrome, pixel typography, terminal voice",
  ]
  return `${lines.join("\n")}\n`
}
