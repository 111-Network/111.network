#!/usr/bin/env node
/**
 * Copy check (docs/REDESIGN-PLAN.md §7 "Copy check"). Runs after `next build`
 * inside the `build` script, so a Vercel deploy fails on a leak.
 *
 * Both lists run over the same inputs:
 *  - built output: the visible text of every prerendered page in
 *    .next/server/app/**\/*.html (text nodes + aria-label / alt / title /
 *    content / placeholder / value values; <script> and <style> bodies are
 *    dropped because the RSC payload duplicates the text, JSON-LD is kept),
 *    every text-like prerendered route body (.next/server/app/**\/*.body:
 *    llms.txt, manifest, robots, sitemap), the text files in public/ and
 *    src/app/**\/*.alt.txt;
 *  - source: the string literals, template text and JSX text of
 *    src/**\/*.{ts,tsx} (TypeScript parser; import/export specifiers and
 *    *.test.* files are skipped). Source matters because most interactive copy
 *    (typed logs, terminal output, popovers, per-device states) is client-only
 *    and never reaches the prerendered HTML.
 *
 *  1. `text` list (case-insensitive, whole word): words the final logic rejects.
 *  2. `names` list (case-sensitive, plus the ALL-CAPS spelling): tech-stack
 *     proper nouns (W1). A version / model suffix ("Qwen3", "GPT4o") or a
 *     CamelCase compound ("MeshtasticPKI") still counts as the name.
 *     Entries with "exactlyOnce" (W2) must appear exactly once in src and
 *     exactly once in the home page HTML, and nowhere else.
 *  3. `requiredFiles` must exist in the built output; `mustContain` texts
 *     (with {SITE_CONSTANT} placeholders from src/lib/site.ts) must appear in
 *     their route or file.
 *  4. /demo import denylist: nothing under the demo dirs may import (directly
 *     or through local modules) a denied package.
 *
 * The `legacy` block of copy-denylist.json tolerates what the not-yet-replaced
 * legacy frame still renders. Every tolerance names the phase that removes it.
 * Phase agents never edit copy-denylist.json: the orchestrator deletes the
 * entries the report lists as no longer needed, once per phase.
 *
 * Usage: node scripts/check-copy.mjs [--src-only] [--next-dir <dir>] [--config <file>]
 * Exit:  0 clean · 1 copy errors · 2 missing build output or bad config
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"
import { readSiteConstants } from "./site-constants.mjs"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(SCRIPT_DIR, "..")
export const DEFAULT_CONFIG = path.join(SCRIPT_DIR, "copy-denylist.json")

const WORD = "A-Za-z0-9_"
const SEGMENT_BREAK = " | "
const TEXT_ATTRS = [
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
  "alt",
  "title",
  "content",
  "placeholder",
  "value",
]
const DEFAULT_WHY = {
  text: "copy the final logic rejects (W1 / plan §11)",
  names: "tech-stack name in user-visible copy (W1)",
  allow: "always allowed",
}

// ---------------------------------------------------------------- matching

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * What may follow a match. text entries: never a letter, digit or underscore.
 * names entries also catch versioned and compound spellings:
 * - a digit may follow any name ("Qwen3-4B", "Llama3", "GPT4o", "LoRa32");
 * - an uppercase letter may follow a name ending in a lowercase letter
 *   (CamelCase compound: "MeshtasticPKI", "ReactDOM"), but not an ALL-CAPS
 *   one ("RAK" never matches "RAKE");
 * - a name ending in a digit may be followed by letters ("ESP32S3").
 */
function rightBoundary(list, term) {
  if (list !== "names") return `(?![${WORD}])`
  const last = term[term.length - 1]
  if (/[a-z]/.test(last)) return "(?![a-z_])"
  if (/[A-Z]/.test(last)) return "(?![A-Za-z_])"
  return "(?!_)"
}

function termPattern(term, list, plural) {
  const body = term.split(/\s+/).map(escapeRe).join("\\s*")
  const suffix = plural ? (term === term.toUpperCase() && /[A-Z]$/.test(term) ? "(?:E?S)?" : "(?:e?s)?") : ""
  return `${body}${suffix}${rightBoundary(list, term)}`
}

/**
 * Compile one denylist entry. A string is shorthand for { term }.
 * - text entries are case-insensitive, names entries case-sensitive, unless
 *   the entry sets "caseSensitive".
 * - whole word on the left: the match may not follow a letter, digit or
 *   underscore. On the right see rightBoundary (names allow version suffixes).
 * - a case-sensitive names entry also matches its ALL-CAPS spelling
 *   ("LoRa" = "LORA", "Next.js" = "NEXT.JS"); set "upper": false to turn that off.
 * - whitespace inside a term also matches no whitespace ("64 KB" = "64KB").
 * - a term ending in three lowercase letters also matches its plural
 *   ("satellite" = "satellites"); set "plural": false to turn that off.
 */
export function compileEntry(raw, list) {
  const entry = typeof raw === "string" ? { term: raw } : { ...raw }
  if (typeof entry.term !== "string" || !entry.term.trim()) {
    throw new Error(`copy-denylist: ${list} entry without a "term": ${JSON.stringify(raw)}`)
  }
  const term = entry.term.trim()
  const caseSensitive = entry.caseSensitive ?? list !== "text"
  const plural = entry.plural ?? /[a-z]{3}$/.test(term)
  const spellings = [term]
  const upper = term.toUpperCase()
  if (list === "names" && caseSensitive && entry.upper !== false && upper !== term) spellings.push(upper)
  const alternatives = spellings.map((s) => termPattern(s, list, plural))
  const pattern = `(?<![${WORD}])(?:${alternatives.join("|")})`
  return {
    list,
    term,
    caseSensitive,
    allowOn: entry.allowOn ?? [],
    exactlyOnce: entry.exactlyOnce === true,
    why: entry.why ?? DEFAULT_WHY[list] ?? "",
    re: new RegExp(pattern, caseSensitive ? "g" : "gi"),
  }
}

/** Every match of a compiled entry in `text`, as { start, end, match }. */
export function findMatches(entry, text) {
  const out = []
  entry.re.lastIndex = 0
  let m
  while ((m = entry.re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, match: m[0] })
    if (m[0].length === 0) entry.re.lastIndex++
  }
  return out
}

function covered(spans, hit) {
  return spans.some((s) => s.start <= hit.start && hit.end <= s.end)
}

/**
 * Does a route / file id match an allowOn or legacy pattern?
 * "*" matches everything; "**" any characters; "*" inside a pattern any
 * characters except "/"; anything else is an exact id ("/terms",
 * "src/app/terms/page.tsx").
 */
export function matchesId(pattern, id) {
  if (pattern === "*") return true
  if (!pattern.includes("*")) return pattern === id
  let re = ""
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === "*" && pattern[i + 1] === "*") {
      re += ".*"
      i++
    } else if (c === "*") {
      re += "[^/]*"
    } else {
      re += escapeRe(c)
    }
  }
  return new RegExp(`^${re}$`).test(id)
}

export function normalizeSpace(s) {
  return s.replace(/\s+/g, " ").trim()
}

function snippet(text, hit, radius = 40) {
  const from = Math.max(0, hit.start - radius)
  const to = Math.min(text.length, hit.end + radius)
  return `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`
}

// -------------------------------------------------------------------- HTML

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  bull: "•",
  rarr: "→",
  larr: "←",
  times: "×",
  copy: "©",
}

export function decodeEntities(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (m, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m
  })
}

/**
 * The text a visitor (or a search engine) can read on a prerendered page:
 * text nodes plus the TEXT_ATTRS values, entity-decoded, whitespace-collapsed.
 * <script> bodies are dropped (the RSC payload repeats the page text) except
 * application/ld+json, which search engines show. <style> bodies are dropped.
 */
export function htmlToText(html) {
  const attrValues = []
  const attrRe = new RegExp(`\\s(?:${TEXT_ATTRS.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "gi")
  const body = html
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_, attrs, inner) =>
      /\btype\s*=\s*["']?application\/ld\+json/i.test(attrs) ? ` ${inner} ` : " ",
    )
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[A-Za-z][^>]*>/g, (tag) => {
      for (const m of tag.matchAll(attrRe)) attrValues.push(m[1] ?? m[2] ?? "")
      return " "
    })
    .replace(/<[^>]*>/g, " ")
  return [body, ...attrValues]
    .map((part) => normalizeSpace(decodeEntities(part)))
    .filter(Boolean)
    .join(SEGMENT_BREAK)
}

/** ".next/server/app/terms.html" → "/terms"; "index.html" → "/". */
export function routeFromHtmlPath(relPath) {
  const noExt = relPath.split(path.sep).join("/").replace(/\.html$/, "")
  const route = `/${noExt}`.replace(/\/index$/, "")
  return route === "" ? "/" : route
}

// ------------------------------------------------------------------ source

function scriptKind(id) {
  if (id.endsWith(".tsx")) return ts.ScriptKind.TSX
  if (id.endsWith(".ts") || id.endsWith(".mts") || id.endsWith(".cts")) return ts.ScriptKind.TS
  if (id.endsWith(".jsx")) return ts.ScriptKind.JSX
  return ts.ScriptKind.JS
}

function parse(id, code) {
  return ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, scriptKind(id))
}

function isImportCall(node) {
  return (
    ts.isCallExpression(node) &&
    node.arguments.length > 0 &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require"))
  )
}

/** True for "x" in import/export … from "x", import("x"), require("x"), import("x").T, declare module "x". */
export function isModuleSpecifier(node) {
  const p = node.parent
  if (!p) return false
  if ((ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) && p.moduleSpecifier === node) return true
  if (ts.isExternalModuleReference(p)) return true
  if (ts.isModuleDeclaration(p) && p.name === node) return true
  if (isImportCall(p) && p.arguments[0] === node) return true
  if (ts.isLiteralTypeNode(p) && p.parent && ts.isImportTypeNode(p.parent)) return true
  return false
}

/** String literals, template text and JSX text of one file, as { text, line }. */
export function extractSourceStrings(id, code) {
  const sf = parse(id, code)
  const out = []
  const push = (node, raw) => {
    const text = normalizeSpace(raw)
    if (!text) return
    out.push({ text, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 })
  }
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isModuleSpecifier(node)) {
        // JSX attribute strings keep HTML entities verbatim; decode them like JSX text.
        push(node, node.parent && ts.isJsxAttribute(node.parent) ? decodeEntities(node.text) : node.text)
      }
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      push(node, node.text)
    } else if (ts.isJsxText(node)) {
      push(node, decodeEntities(node.text))
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

function isTypeOnlyImport(node) {
  if (ts.isExportDeclaration(node)) return node.isTypeOnly
  const clause = node.importClause
  if (!clause) return false // side-effect import
  if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword || clause.isTypeOnly) return true
  // import { type A, type B } from "x" is elided too
  const named = clause.namedBindings
  return !clause.name && !!named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((el) => el.isTypeOnly)
}

/** Runtime module specifiers of one file (type-only imports are skipped), as { spec, line }. */
export function extractImports(id, code) {
  const sf = parse(id, code)
  const out = []
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyImport(node)) out.push({ spec: node.moduleSpecifier.text, line: lineOf(node) })
    } else if (isImportCall(node) && ts.isStringLiteralLike(node.arguments[0])) {
      out.push({ spec: node.arguments[0].text, line: lineOf(node) })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

function packageName(spec) {
  const parts = spec.split("/")
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"]

/** Resolve "@/x" and relative specifiers against the in-memory file map; null for packages. */
export function resolveLocal(fromId, spec, files) {
  let base
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`
  else if (spec.startsWith("./") || spec.startsWith("../")) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec))
  else return null
  for (const suffix of RESOLVE_SUFFIXES) {
    if (files.has(base + suffix)) return base + suffix
  }
  return undefined // local but not found (asset, css, generated): nothing to follow
}

/**
 * /demo import denylist. Walks every file under config.dirs and the local
 * modules it pulls in; reports each denied package once per importing file,
 * with the chain from the demo file that reaches it.
 */
export function checkDemoImports(files, demoConfig) {
  const findings = []
  if (!demoConfig) return findings
  const deny = new Set(demoConfig.deny ?? [])
  const dirs = (demoConfig.dirs ?? []).map((d) => d.replace(/\/$/, ""))
  const roots = [...files.keys()].filter((id) => dirs.some((d) => id.startsWith(`${d}/`))).sort()
  const reported = new Set()
  const importsOf = new Map()
  const getImports = (id) => {
    if (!importsOf.has(id)) importsOf.set(id, extractImports(id, files.get(id)))
    return importsOf.get(id)
  }
  for (const root of roots) {
    const queue = [[root]]
    const seen = new Set([root])
    while (queue.length) {
      const chain = queue.shift()
      const id = chain[chain.length - 1]
      for (const { spec, line } of getImports(id)) {
        const local = resolveLocal(id, spec, files)
        if (local === null) {
          const pkg = packageName(spec)
          const key = `${id}|${pkg}`
          if (deny.has(pkg) && !reported.has(key)) {
            reported.add(key)
            findings.push({
              level: "error",
              list: "imports",
              term: pkg,
              id: root,
              file: `${id}:${line}`,
              snippet: chain.length > 1 ? `${chain.join(" → ")} imports "${spec}"` : `imports "${spec}"`,
              why: demoConfig.why ?? "the /demo shell has no framer-motion / lucide-react (plan §6.5)",
            })
          }
        } else if (local && !seen.has(local)) {
          seen.add(local)
          queue.push([...chain, local])
        }
      }
    }
  }
  return findings
}

// ------------------------------------------------------------------- check

function normalizeLegacy(legacy = {}) {
  return {
    skipSource: (legacy.skipSource ?? []).map((s) => ({ ...s, used: 0 })),
    tolerate: (legacy.tolerate ?? []).map((t) => ({
      ...t,
      used: 0,
      re: new RegExp(t.phrase.trim().split(/\s+/).map(escapeRe).join("\\s*"), "gi"),
    })),
    exactlyOncePending: legacy.exactlyOncePending ? { ...legacy.exactlyOncePending, used: 0 } : null,
    mustContainPending: (legacy.mustContainPending ?? []).map((p) => ({ ...p, used: 0 })),
  }
}

/** Replace {NAME} placeholders with src/lib/site.ts constants; unknown names are an error. */
export function fillPlaceholders(text, constants = {}) {
  return text.replace(/\{([A-Z][A-Z0-9_]*)\}/g, (m, name) => {
    const value = constants[name]
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw Object.assign(new Error(`copy-denylist: mustContain placeholder ${m} is not a constant in src/lib/site.ts`), { exitCode: 2 })
    }
    return String(value)
  })
}

function phraseSpans(re, text) {
  const out = []
  re.lastIndex = 0
  let m
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length })
    if (m[0].length === 0) re.lastIndex++
  }
  return out
}

export function isTestFile(id) {
  return /\.test\.[cm]?[jt]sx?$/.test(id)
}

/**
 * Pure core of the check.
 * @param {object} input
 * @param {object} input.config     parsed copy-denylist.json
 * @param {{id:string,file:string,html:string}[]} [input.pages]   prerendered pages (id = route)
 * @param {{id:string,file:string,text:string}[]} [input.textFiles] llms.txt, manifest, robots, sitemap, alt texts
 * @param {Map<string,string>} [input.sources]  repo-relative path → code, for all of src/
 * @param {Record<string,unknown>} [input.constants]  exported literals of src/lib/site.ts (mustContain placeholders)
 * @param {boolean} [input.built]   true when built output was loaded (enables requiredFiles / mustContain)
 * @returns {{ findings: object[], legacy: object, stats: object }}
 */
export function runCopyCheck({ config, pages = [], textFiles = [], sources = new Map(), constants = {}, built = pages.length > 0 }) {
  const text = (config.text ?? []).map((e) => compileEntry(e, "text"))
  const names = (config.names ?? []).map((e) => compileEntry(e, "names"))
  const always = (config.alwaysAllowed ?? []).map((t) => compileEntry({ term: t, caseSensitive: true, plural: false }, "allow"))
  const legacy = normalizeLegacy(config.legacy)
  const findings = []
  const w2 = new Map(names.filter((e) => e.exactlyOnce).map((e) => [e.term, { src: [], home: [], elsewhere: [] }]))

  /**
   * Classify the hits of `entries` in one text; `where` is "home" | "src" | "elsewhere".
   * A phrase tolerance applies where its `route` pattern matches the id: a route
   * ("/", "/llms.txt", "*") or a source path ("src/app/layout.tsx").
   * Legacy source listed in skipSource is skipped whole.
   */
  const scan = (entries, body, { id, file, line, where }) => {
    const masks = always.flatMap((a) => findMatches(a, body))
    const tolerances = legacy.tolerate.filter((t) => matchesId(t.route, id)).map((t) => ({ t, spans: phraseSpans(t.re, body) }))
    for (const entry of entries) {
      for (const hit of findMatches(entry, body)) {
        if (covered(masks, hit)) continue
        if (entry.allowOn.some((p) => matchesId(p, id))) continue
        const finding = {
          list: entry.list,
          term: entry.term,
          match: hit.match,
          id,
          file: line ? `${file}:${line}` : file,
          snippet: snippet(body, hit),
          why: entry.why,
        }
        const tolerance = tolerances.find(({ spans }) => covered(spans, hit))
        if (tolerance) {
          tolerance.t.used++
          findings.push({ ...finding, level: "legacy", removeIn: tolerance.t.removeIn })
        } else if (entry.exactlyOnce) {
          w2.get(entry.term)[where].push(finding)
        } else {
          findings.push({ ...finding, level: "error" })
        }
      }
    }
  }

  // 1. built output + plain text files
  for (const page of pages) {
    scan([...text, ...names], htmlToText(page.html), { id: page.id, file: page.file, where: page.id === "/" ? "home" : "elsewhere" })
  }
  for (const doc of textFiles) {
    scan([...text, ...names], normalizeSpace(doc.text), { id: doc.id, file: doc.file, where: "elsewhere" })
  }

  // 2. source string literals
  let sourceCount = 0
  for (const [id, code] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    if (!/\.tsx?$/.test(id) || id.endsWith(".d.ts") || isTestFile(id)) continue
    const skip = legacy.skipSource.find((s) => matchesId(s.path, id))
    if (skip) {
      skip.used++
      continue
    }
    sourceCount++
    for (const lit of extractSourceStrings(id, code)) {
      scan([...text, ...names], lit.text, { id, file: id, line: lit.line, where: "src" })
    }
  }

  // 3. W2: exactly once in src, exactly once on the home page, nowhere else
  const pendingTerms = []
  for (const [term, c] of w2) {
    for (const f of c.elsewhere) {
      findings.push({ ...f, level: "error", why: `W2: "${term}" may appear only in the one Layer 6 line on the home page` })
    }
    const counts = [["src string literals", c.src, "src"]]
    if (pages.length) counts.push(["the home page HTML", c.home, "/"])
    for (const [label, hits, id] of counts) {
      if (hits.length > 1) {
        for (const f of hits) findings.push({ ...f, level: "error", why: `W2: "${term}" must appear exactly once in ${label}; found ${hits.length}` })
      } else if (hits.length === 0) {
        if (legacy.exactlyOncePending) {
          if (!pendingTerms.includes(term)) pendingTerms.push(term)
        } else {
          findings.push({
            level: "error",
            list: "names",
            term,
            match: term,
            id,
            file: id === "/" ? "home page" : "src/**",
            snippet: "",
            why: `W2: "${term}" must appear exactly once in ${label}; found 0`,
          })
        }
      }
    }
  }
  if (legacy.exactlyOncePending) legacy.exactlyOncePending.used = pendingTerms.length
  legacy.pendingTerms = pendingTerms

  // 4. required built files and required texts (built output only)
  if (built) {
    const outputs = new Map([...pages.map((p) => [p.id, () => htmlToText(p.html)]), ...textFiles.map((d) => [d.id, () => normalizeSpace(d.text)])])
    for (const id of config.requiredFiles ?? []) {
      if (!outputs.has(id)) {
        findings.push({ level: "error", list: "required", term: id, match: id, id, file: "build output", snippet: "", why: `${id} must exist (public/ file or a prerendered route; a route handler needs \`export const dynamic = "force-static"\`)` })
      }
    }
    for (const rule of config.mustContain ?? []) {
      const wanted = normalizeSpace(fillPlaceholders(rule.text, constants))
      const read = outputs.get(rule.id)
      if (read && read().includes(wanted)) continue
      const why = `${rule.id} must contain ${JSON.stringify(wanted)}${rule.why ? ` (${rule.why})` : ""}`
      const pending = legacy.mustContainPending.find((p) => p.id === rule.id)
      const finding = { list: "mustContain", term: wanted, match: wanted, id: rule.id, file: read ? rule.id : "missing", snippet: "", why }
      if (pending) {
        pending.used++
        findings.push({ ...finding, level: "legacy", removeIn: pending.removeIn })
      } else {
        findings.push({ ...finding, level: "error" })
      }
    }
  }

  // 5. /demo import denylist
  findings.push(...checkDemoImports(sources, config.demoImports))

  return {
    findings,
    legacy,
    stats: { pages: pages.map((p) => p.id), textFiles: textFiles.map((d) => d.id), sourceFiles: sourceCount, built },
  }
}

// ---------------------------------------------------------------- report

export function formatReport({ findings, legacy, stats }) {
  const lines = []
  const errors = findings.filter((f) => f.level === "error")
  const tolerated = findings.filter((f) => f.level === "legacy")
  lines.push(
    `check-copy: ${stats.pages.length} page(s) [${stats.pages.join(", ") || "none"}], ` +
      `${stats.textFiles.length} text file(s) [${stats.textFiles.join(", ") || "none"}], ${stats.sourceFiles} source file(s)` +
      (stats.built === false ? " (--src-only: build-output rules skipped)" : ""),
  )
  // The same sentence often repeats on one page (description, og:description,
  // twitter:description): print it once with a count.
  const grouped = new Map()
  for (const f of errors) {
    const line = `ERROR [${f.list}] "${f.match ?? f.term}" on ${f.id} (${f.file})${f.snippet ? `: ${JSON.stringify(f.snippet)}` : ""} · ${f.why}`
    grouped.set(line, (grouped.get(line) ?? 0) + 1)
  }
  for (const [line, count] of grouped) lines.push(count > 1 ? `${line} (×${count})` : line)

  const inUse = []
  const stale = []
  // Without built output (--src-only) an entry about the build cannot be judged stale.
  const judged = (route) => stats.built !== false || route.startsWith("src/")
  for (const t of legacy.tolerate) {
    const label = `[${t.removeIn ?? "?"}] tolerate "${t.phrase}" on ${t.route}${t.why ? ` (${t.why})` : ""}`
    if (t.used) inUse.push(`${label}: ${t.used} hit(s)`)
    else if (judged(t.route)) stale.push(label)
  }
  for (const s of legacy.skipSource) {
    const label = `[${s.removeIn ?? "?"}] skip ${s.path}${s.why ? ` (${s.why})` : ""}`
    if (s.used) inUse.push(`${label}: ${s.used} file(s)`)
    else stale.push(label)
  }
  if (legacy.exactlyOncePending) {
    const p = legacy.exactlyOncePending
    const label = `[${p.removeIn ?? "?"}] W2 exactly-once relaxed to at-most-once${p.why ? ` (${p.why})` : ""}`
    if (legacy.pendingTerms.length) inUse.push(`${label}: not placed yet: ${legacy.pendingTerms.join(", ")}`)
    else stale.push(label)
  }
  for (const p of legacy.mustContainPending ?? []) {
    const label = `[${p.removeIn ?? "?"}] mustContain pending on ${p.id}${p.why ? ` (${p.why})` : ""}`
    if (p.used) inUse.push(`${label}: ${p.used} text(s) still missing`)
    else if (judged(p.id)) stale.push(label)
  }
  if (inUse.length) {
    lines.push(`WARNING legacy allowances still in use: ${inUse.length} (${tolerated.length} tolerated hit(s)); each goes in its phase:`)
    for (const l of inUse) lines.push(`  - ${l}`)
  }
  if (stale.length) {
    lines.push(
      "NOTE legacy entries no longer needed (the orchestrator deletes them from scripts/copy-denylist.json after the phase lands; phase agents do not edit that file):",
    )
    for (const l of stale) lines.push(`  - ${l}`)
  }
  lines.push(errors.length ? `check-copy: FAILED, ${errors.length} error(s)` : "check-copy: OK")
  return lines.join("\n")
}

// ------------------------------------------------------------------ inputs

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, filter, out)
    else if (filter(full)) out.push(full)
  }
  return out
}

const rel = (root, file) => path.relative(root, file).split(path.sep).join("/")

const TEXT_EXT = /\.(?:txt|webmanifest|json|xml|md|csv)$/i

/**
 * Is a prerendered route body (".next/server/app/x.body") text? Uses the
 * content-type in its sibling .meta file, else the route's extension.
 */
export function isTextBody(routeId, meta) {
  const type = meta?.headers?.["content-type"]
  if (typeof type === "string") return /^text\/|json|xml|manifest|markdown|csv/i.test(type)
  return TEXT_EXT.test(routeId)
}

/** ".next/server/app/llms.txt.body" → "/llms.txt" (path relative to server/app). */
export function routeFromBodyPath(relPath) {
  return `/${relPath.split(path.sep).join("/").replace(/\.body$/, "")}`
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return undefined
  }
}

export function loadInputs({ root = ROOT, nextDir = path.join(root, ".next"), srcOnly = false } = {}) {
  const appDir = path.join(nextDir, "server", "app")
  const pages = []
  const textFiles = []
  if (!srcOnly) {
    if (!fs.existsSync(appDir)) {
      throw Object.assign(new Error(`no build output at ${rel(root, appDir)}; run \`next build\` first (or pass --src-only)`), { exitCode: 2 })
    }
    for (const file of walk(appDir, (f) => f.endsWith(".html")).sort()) {
      pages.push({ id: routeFromHtmlPath(path.relative(appDir, file)), file: rel(root, file), html: fs.readFileSync(file, "utf8") })
    }
    // Prerendered route handlers and metadata routes: llms.txt, manifest, robots, sitemap.
    for (const file of walk(appDir, (f) => f.endsWith(".body")).sort()) {
      const id = routeFromBodyPath(path.relative(appDir, file))
      if (isTextBody(id, readJson(file.replace(/\.body$/, ".meta")))) {
        textFiles.push({ id, file: rel(root, file), text: fs.readFileSync(file, "utf8") })
      }
    }
  }
  // Static text files served from public/ (llms.txt until P1 turns it into a route).
  const publicDir = path.join(root, "public")
  for (const file of walk(publicDir, (f) => TEXT_EXT.test(f)).sort()) {
    textFiles.push({ id: `/${rel(publicDir, file)}`, file: rel(root, file), text: fs.readFileSync(file, "utf8") })
  }
  const srcApp = path.join(root, "src", "app")
  for (const file of walk(srcApp, (f) => f.endsWith(".alt.txt")).sort()) {
    textFiles.push({ id: `/${rel(srcApp, file)}`, file: rel(root, file), text: fs.readFileSync(file, "utf8") })
  }
  const sources = new Map()
  for (const file of walk(path.join(root, "src"), (f) => /\.(?:[cm]?[jt]sx?)$/.test(f))) {
    sources.set(rel(root, file), fs.readFileSync(file, "utf8"))
  }
  const siteFile = path.join(root, "src", "lib", "site.ts")
  const constants = fs.existsSync(siteFile) ? readSiteConstants(fs.readFileSync(siteFile, "utf8")) : {}
  return { pages, textFiles, sources, constants, built: !srcOnly }
}

function parseArgs(argv) {
  const args = { srcOnly: false, nextDir: undefined, config: DEFAULT_CONFIG }
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split("=", 2)
    const value = () => inline ?? argv[++i]
    if (flag === "--src-only") args.srcOnly = true
    else if (flag === "--next-dir") args.nextDir = path.resolve(value())
    else if (flag === "--config") args.config = path.resolve(value())
    else throw Object.assign(new Error(`unknown argument ${argv[i]}`), { exitCode: 2 })
  }
  return args
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2))
    const config = JSON.parse(fs.readFileSync(args.config, "utf8"))
    const inputs = loadInputs({ nextDir: args.nextDir, srcOnly: args.srcOnly })
    const result = runCopyCheck({ config, ...inputs })
    const report = formatReport(result)
    const failed = result.findings.some((f) => f.level === "error")
    ;(failed ? console.error : console.log)(report)
    process.exitCode = failed ? 1 : 0
  } catch (err) {
    console.error(`check-copy: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = err && typeof err === "object" && "exitCode" in err ? err.exitCode : 2
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main()
