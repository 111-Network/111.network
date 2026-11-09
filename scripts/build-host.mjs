#!/usr/bin/env node
/**
 * `pnpm build:host`: the production build in the host's output layout, then the
 * same post-build checks the host runs, plus the JS budget.
 *
 *   NEXT_ADAPTER_PATH=scripts/layout-probe-adapter.mjs next build
 *   node scripts/check-copy.mjs
 *   node scripts/check-budget.mjs
 *
 * `next start` (and so `pnpm e2e`) serves this output as well as the classic one.
 * Exit: the first non-zero exit code of the steps, else 0.
 */
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const env = { ...process.env, NEXT_ADAPTER_PATH: path.join(ROOT, "scripts", "layout-probe-adapter.mjs") }

const steps = [
  [process.execPath, [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "build"]],
  [process.execPath, [path.join(ROOT, "scripts", "check-copy.mjs")]],
  [process.execPath, [path.join(ROOT, "scripts", "check-budget.mjs")]],
]

for (const [cmd, args] of steps) {
  const r = spawnSync(cmd, args, { cwd: ROOT, env, stdio: "inherit" })
  if (r.status !== 0) {
    console.error(`build:host: ${path.basename(args[0])} ${args.slice(1).join(" ")} exited ${r.status ?? r.signal}`)
    process.exit(r.status ?? 1)
  }
}
console.log("build:host: OK (host output layout)")
