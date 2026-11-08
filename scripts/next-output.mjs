/**
 * Where `next build` leaves the prerendered routes (HTML pages, route-handler
 * bodies). Shared by check-copy and check-budget.
 *
 * Two layouts exist, and the build host picks one:
 *  - classic (local `next build`):   .next/server/app/<route>.html | <route>.body
 *  - adapter (Vercel sets NEXT_ENABLE_ADAPTER=1, so Next 16.4 writes them for the
 *    host's build adapter instead of to server/app):
 *      .next/server/route-cache/APP_PAGE/<hash>/$/<route>.html
 *      .next/server/route-cache/APP_ROUTE/<hash>/$/<route>.body
 *    The <hash> directory is one per route; the path under `$` is the same
 *    relative path the classic layout uses, so route ids come out identical.
 *
 * Both layouts are read when both exist; a path seen twice keeps the first.
 */
import fs from "node:fs"
import path from "node:path"

/** Directories whose relative paths are route ids ("index.html", "terms.html", "llms.txt.body"). */
export function prerenderRoots(nextDir) {
  const roots = []
  const classic = path.join(nextDir, "server", "app")
  if (fs.existsSync(classic)) roots.push(classic)
  const cache = path.join(nextDir, "server", "route-cache")
  if (fs.existsSync(cache)) {
    for (const kind of fs.readdirSync(cache).sort()) {
      const kindDir = path.join(cache, kind)
      if (!fs.statSync(kindDir).isDirectory()) continue
      for (const hash of fs.readdirSync(kindDir).sort()) {
        const root = path.join(kindDir, hash, "$")
        if (fs.existsSync(root)) roots.push(root)
      }
    }
  }
  return roots
}

function walk(dir, filter, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, filter, out)
    else if (filter(full)) out.push(full)
  }
  return out
}

/**
 * Every prerendered file with the given extension: [{ rel, file }] where `rel`
 * is relative to its root (the route id source) and `file` is absolute.
 * Sorted by rel; the first file wins when two layouts hold the same rel.
 */
export function listPrerendered(nextDir, ext) {
  const seen = new Map()
  for (const root of prerenderRoots(nextDir)) {
    for (const file of walk(root, (f) => f.endsWith(ext))) {
      const rel = path.relative(root, file)
      if (!seen.has(rel)) seen.set(rel, file)
    }
  }
  return [...seen].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([rel, file]) => ({ rel, file }))
}

/** Absolute path of one prerendered file ("index.html"), or undefined when the build did not write it. */
export function findPrerendered(nextDir, rel) {
  for (const root of prerenderRoots(nextDir)) {
    const file = path.join(root, rel)
    if (fs.existsSync(file)) return file
  }
  return undefined
}
