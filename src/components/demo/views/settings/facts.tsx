// Maps the pure FactRow values from model.ts onto SpecTable rows (real views/settings/facts.tsx):
// stacked lines, a status dot with its word for service rows, copy buttons.
import { CopyButton } from "../../ui/copy-button"
import type { SpecRow } from "../../ui/spec-table"
import { StatusDot } from "../../ui/status-dot"
import type { FactRow } from "./model"

function Value({ row }: { row: FactRow }) {
  const text =
    typeof row.value === "string" ? (
      <span className="break-words">{row.value}</span>
    ) : (
      <span className="flex flex-col items-end gap-0.5">
        {row.value.map((line) => (
          <span key={line} className="break-words">
            {line}
          </span>
        ))}
      </span>
    )
  const body = row.state ? (
    <span className="flex flex-col items-end gap-1">
      <StatusDot state={row.state} />
      {text}
    </span>
  ) : (
    text
  )
  if (row.copy === undefined) return body
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {body}
      <CopyButton text={row.copy} ariaLabel={`Copy ${row.label.toLowerCase()}`} />
    </span>
  )
}

export function toSpecRows(rows: readonly FactRow[]): SpecRow[] {
  return rows.map((row) => ({ label: row.label, value: <Value row={row} />, minMode: row.minMode }))
}
