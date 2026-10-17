#!/usr/bin/env node
/**
 * Install URL check (docs/REDESIGN-PLAN.md §3.3, W10). Part of `pnpm check`,
 * not of `build`, so a Vercel deploy never depends on the network.
 *
 * - Always: every INSTALL_COMMANDS string in src/lib/site.ts must contain
 *   INSTALL_URL (the copyable command and the checked URL never drift apart).
 * - While INSTALL_LIVE is false: nothing else (the card says "installer
 *   publishes with the first release").
 * - Once INSTALL_LIVE is true: HEAD INSTALL_URL (redirects followed, 10 s
 *   timeout) and fail unless it answers 200.
 *
 * Usage: node scripts/check-install.mjs [--site <path to site.ts>]
 * Exit:  0 ok · 1 check failed · 2 site.ts unreadable or constants missing
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { readSiteConstants } from "./site-constants.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const TIMEOUT_MS = 10_000

/**
 * Static part of the check. Returns { live, url, problems: string[] }, or
 * throws (exitCode 2) when the constants cannot be read.
 */
export function inspectInstallConstants(constants) {
  const { INSTALL_LIVE: live, INSTALL_URL: url, INSTALL_COMMANDS: commands } = constants
  if (typeof live !== "boolean" || typeof url !== "string" || !commands || typeof commands !== "object") {
    throw Object.assign(new Error("src/lib/site.ts must export INSTALL_LIVE (boolean literal), INSTALL_URL (string) and INSTALL_COMMANDS (object of strings)"), {
      exitCode: 2,
    })
  }
  const problems = []
  if (!/^https:\/\//.test(url)) problems.push(`INSTALL_URL must be https: ${url}`)
  for (const [target, command] of Object.entries(commands)) {
    if (typeof command !== "string" || !command.includes(url)) problems.push(`INSTALL_COMMANDS.${target} does not contain INSTALL_URL (${url})`)
  }
  return { live, url, problems }
}

/** HEAD the URL; resolves to { ok, status?, error? }. `fetchImpl` is injectable for tests. */
export async function headUrl(url, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  try {
    const res = await fetchImpl(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(timeoutMs) })
    return { ok: res.status === 200, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const i = argv.indexOf("--site")
  const siteFile = i === -1 ? path.join(ROOT, "src", "lib", "site.ts") : path.resolve(argv[i + 1])
  try {
    const { live, url, problems } = inspectInstallConstants(readSiteConstants(fs.readFileSync(siteFile, "utf8")))
    for (const p of problems) console.error(`check-install: ${p}`)
    if (!live) {
      console.log(`check-install: INSTALL_LIVE is false; ${url} is not checked until the flag is flipped`)
    } else {
      const r = await headUrl(url)
      if (r.ok) console.log(`check-install: HEAD ${url} → 200`)
      else {
        console.error(`check-install: INSTALL_LIVE is true but HEAD ${url} → ${r.status ?? r.error}; expected 200`)
        problems.push("install URL not live")
      }
    }
    console.log(problems.length ? "check-install: FAILED" : "check-install: OK")
    process.exitCode = problems.length ? 1 : 0
  } catch (err) {
    console.error(`check-install: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = err && typeof err === "object" && "exitCode" in err ? err.exitCode : 2
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main()
