// Roving-focus key handling of Segmented (React-free). Real source: os/4-interface/ui/src/components/segmented.tsx.

/** Index to move to from `from` in direction `dir`, skipping disabled options, wrapping. */
export function nextEnabled(disabled: readonly boolean[], from: number, dir: 1 | -1): number {
  const n = disabled.length
  let i = from
  for (let s = 0; s < n; s++) {
    i = (i + dir + n) % n
    if (!disabled[i]) return i
  }
  return from
}

/**
 * Target index for a key press on option `index`, or null when the key is not handled.
 * Logical arrows: ArrowRight is "next" in LTR and "previous" in RTL; Up/Down ignore direction;
 * Home/End jump to the first/last enabled option (-1 when every option is disabled).
 */
export function segmentedKeyTarget(key: string, index: number, disabled: readonly boolean[], rtl = false): number | null {
  switch (key) {
    case "ArrowRight":
      return nextEnabled(disabled, index, rtl ? -1 : 1)
    case "ArrowDown":
      return nextEnabled(disabled, index, 1)
    case "ArrowLeft":
      return nextEnabled(disabled, index, rtl ? 1 : -1)
    case "ArrowUp":
      return nextEnabled(disabled, index, -1)
    case "Home":
      return disabled.findIndex((d) => !d)
    case "End":
      return disabled.lastIndexOf(false)
    default:
      return null
  }
}

/** The one option in the tab order: the selected one, else the first enabled one (-1 if none). */
export function segmentedTabStop(selected: number, disabled: readonly boolean[]): number {
  return selected >= 0 && !disabled[selected] ? selected : disabled.findIndex((d) => !d)
}
