#!/usr/bin/env node
/**
 * First-load JS budget per route (docs/REDESIGN-PLAN.md §8, P0 + P5).
 *
 * Next 16 no longer prints sizes after `next build`, so this measures them:
 * it reads the prerendered HTML of each route, collects the JS chunks the page
 * loads at first paint (<script src> and <link rel="preload|modulepreload"
 * as="script"> under /_next/static, minus `nomodule` legacy polyfills), gzips
 * each one from .next/static (level 9, as Next's old size report did) and
 * compares the sum with the route's budget. Chunks loaded later (next/dynamic,
 * lazy views) are not first-load and are not counted.
 *
 * To add a route, add an entry to BUDGETS: { route, html, budgetKB, pending? }.
 * `html` is the file under .next/server/app. A route whose HTML is missing
 * fails the check (it stopped being prerendered, e.g. it now reads
 * searchParams or cookies), unless the entry is marked `pending: true`
 * (its page has not landed yet); then it is skipped with a note.
 *
 * Usage: node scripts/check-budget.mjs [--next-dir <dir>]
 * Exit:  0 within budget · 1 over budget, a chunk missing or a required route not prerendered · 2 no build output
 */
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** kB = 1000 bytes of gzip, first-load JS only. `pending` = page not built yet (skipped, not failed). */
export const BUDGETS = [
  // P0 (legacy frame + ten layer stubs): 203.5 kB → 234 kB.
  // Re-measured 2026-10-17 after P1–P3 (new frame + L0–L3, L5–L9 interactive sections; framer-motion
  // dropped from the cookie banner, saving ~40 kB): 236.1 kB → budget = floor(+15%) = 271 kB.
  { route: "/", html: "index.html", budgetKB: 271 },
  // P4 /demo: foundations gate (site bar + shell + stub views) measured 195.4 kB. Re-measured
  // 2026-10-17 at the integration gate with every view built: 230.5 kB → budget = floor(+15%) = 265 kB.
  // First load is the site bar, the shell and the engine (store, scheduler and every slice reducer with
  // the copy it emits); each view, the nearby radar and the bridge/storage/repairs/gateway service pages
  // are lazy chunks and are not counted. The home loads none of the demo engine.
  { route: "/demo", html: "demo.html", budgetKB: 265 },
]

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1]

/** First-paint JS chunk paths ("/_next/static/…") referenced by one HTML document. */
export function firstLoadScripts(html) {
  const out = new Set()
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    let url
    if (/^<script/i.test(tag)) {
      if (/\snomodule\b/i.test(tag)) continue
      url = attr(tag, "src")
    } else {
      const rel = attr(tag, "rel")?.toLowerCase()
      if (rel !== "modulepreload" && !(rel === "preload" && attr(tag, "as")?.toLowerCase() === "script")) continue
      url = attr(tag, "href")
    }
    if (!url) continue
    const pathname = url.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0]
    if (pathname.startsWith("/_next/static/") && pathname.endsWith(".js")) out.add(pathname)
  }
  return [...out]
}

export function gzipSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length
}

const kB = (bytes) => (bytes / 1000).toFixed(1)

export function measureRoute(nextDir, entry) {
  const htmlFile = path.join(nextDir, "server", "app", entry.html)
  if (!fs.existsSync(htmlFile)) return entry.pending ? { ...entry, skipped: true } : { ...entry, notPrerendered: true }
  const chunks = firstLoadScripts(fs.readFileSync(htmlFile, "utf8")).map((pathname) => {
    const file = path.join(nextDir, "static", decodeURIComponent(pathname.slice("/_next/static/".length)))
    if (!fs.existsSync(file)) return { pathname, missing: true, gzip: 0, raw: 0 }
    const buffer = fs.readFileSync(file)
    return { pathname, gzip: gzipSize(buffer), raw: buffer.length }
  })
  const total = chunks.reduce((sum, c) => sum + c.gzip, 0)
  return { ...entry, chunks, total, over: total > entry.budgetKB * 1000 }
}

function main() {
  const argv = process.argv.slice(2)
  const i = argv.findIndex((a) => a === "--next-dir" || a.startsWith("--next-dir="))
  const nextDir = i === -1 ? path.join(ROOT, ".next") : path.resolve(argv[i].includes("=") ? argv[i].split("=")[1] : argv[i + 1])
  if (!fs.existsSync(path.join(nextDir, "server", "app"))) {
    console.error(`check-budget: no build output in ${nextDir}; run \`next build\` first`)
    process.exitCode = 2
    return
  }
  let failed = false
  for (const entry of BUDGETS) {
    const r = measureRoute(nextDir, entry)
    if (r.skipped) {
      console.log(`check-budget: ${r.route} skipped (pending: ${r.html} not built yet)`)
      continue
    }
    if (r.notPrerendered) {
      console.error(`check-budget: ${r.route} has no prerendered ${r.html}; the route is no longer static (searchParams, cookies, headers?) or was removed`)
      failed = true
      continue
    }
    const missing = r.chunks.filter((c) => c.missing)
    for (const c of missing) console.error(`check-budget: ${r.route} references ${c.pathname}, not found in .next/static`)
    if (r.chunks.length === 0 || missing.length) failed = true
    console.log(
      `check-budget: ${r.route} first-load JS ${kB(r.total)} kB gzip (${r.chunks.length} chunks) / budget ${r.budgetKB} kB` +
        ` · ${r.over ? `OVER by ${kB(r.total - r.budgetKB * 1000)} kB` : `${kB(r.budgetKB * 1000 - r.total)} kB headroom`}`,
    )
    for (const c of [...r.chunks].sort((a, b) => b.gzip - a.gzip)) {
      console.log(`  ${kB(c.gzip).padStart(7)} kB  ${c.pathname}${c.missing ? " (missing)" : ""}`)
    }
    if (r.over) failed = true
  }
  console.log(failed ? "check-budget: FAILED" : "check-budget: OK")
  process.exitCode = failed ? 1 : 0
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main()
