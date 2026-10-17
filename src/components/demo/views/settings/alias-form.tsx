// The node-name editor (real essentials.tsx AliasRow), shared by Essentials and Identity · L2. A real
// input saved to the store with core/renameNode: the node chip, the card plate and the restart
// question follow at once. Empty goes back to the name the node came with. The identity (label,
// keys) never changes with it.
import { useState, type FormEvent } from "react"
import { cn } from "@/lib/utils"
import { SETTINGS_COPY } from "../../copy/settings"
import { useDemo, useDispatch, useWorld } from "../../engine/react"
import { useAnnounce } from "../../shell/context"
import { selectAlias } from "../../shell/select"
import { Button } from "../../ui/button"
import { FIELD_CLASS } from "../../ui/classes"
import { ALIAS_MAX, aliasDirty } from "./model"
import { Feedback } from "./row"

export interface AliasFormProps {
  /** Id of the element that names the field (a Row heading), or omit to give the field its own visible label. */
  labelledBy?: string
  /** Id of the input (unique per page). */
  inputId: string
}

export function AliasForm({ labelledBy, inputId }: AliasFormProps) {
  const alias = useDemo(selectAlias)
  const world = useWorld()
  const dispatch = useDispatch()
  const announce = useAnnounce()
  const [draft, setDraft] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fallback = world.self.name
  const value = draft ?? alias
  const dirty = aliasDirty(draft, alias, fallback)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (draft === null || !dirty) return
    dispatch({ type: "core/renameNode", alias: draft })
    setDraft(null)
    setSaved(true)
    announce(SETTINGS_COPY.alias.saved)
  }

  return (
    <form onSubmit={submit} noValidate>
      {labelledBy ? null : (
        <label htmlFor={inputId} className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {SETTINGS_COPY.rows.alias.label}
        </label>
      )}
      <div className="flex flex-col gap-2 @min-[640px]:flex-row">
        <input
          id={inputId}
          value={value}
          maxLength={ALIAS_MAX}
          autoComplete="off"
          spellCheck={false}
          aria-labelledby={labelledBy}
          placeholder={fallback}
          onChange={(e) => {
            setSaved(false)
            setDraft(e.target.value)
          }}
          className={cn(FIELD_CLASS, "min-h-11 min-w-0 flex-1")}
        />
        <Button type="submit" variant="primary" arrow={false} aria-disabled={!dirty || undefined}>
          {SETTINGS_COPY.alias.save}
        </Button>
      </div>
      <Feedback text={saved ? SETTINGS_COPY.alias.saved : null} />
    </form>
  )
}
