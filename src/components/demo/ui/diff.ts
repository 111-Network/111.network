// Diff model (React-free). Real source: os/40-interface/ui/src/components/diff-view.tsx.

export type DiffLineKind = "add" | "del" | "hunk" | "meta" | "ctx"

/** Classify one line of a unified diff. */
export function classifyDiffLine(line: string): DiffLineKind {
  if (line.startsWith("@@")) return "hunk"
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) return "meta"
  if (line.startsWith("+")) return "add"
  if (line.startsWith("-")) return "del"
  return "ctx"
}

/** Split diff text into lines: CRLF normalised, one trailing newline dropped. */
export function diffLines(diff: string): string[] {
  return diff.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n")
}

/** Monochrome: additions bright, everything else muted. The +/- stay in the text, so it reads unstyled. */
export const DIFF_KIND_CLASS: Readonly<Record<DiffLineKind, string>> = {
  add: "text-foreground",
  del: "text-muted-foreground",
  hunk: "text-muted-foreground",
  meta: "text-muted-foreground",
  ctx: "text-muted-foreground",
}

/** Count of added and removed lines (headers excluded), e.g. for a "+3 −1" summary. */
export function diffStats(diff: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of diffLines(diff)) {
    const kind = classifyDiffLine(line)
    if (kind === "add") added += 1
    else if (kind === "del") removed += 1
  }
  return { added, removed }
}
