import type { CopyState } from "@/hooks/use-copy"
import type { InstallTarget } from "@/lib/site"

// Pure state of the install terminal (plan §3.3), shared by the hero box and
// the nav popover. React-free, so it is unit-tested in plain node.

/** Which command is shown, and how many times the run has been restarted. */
export interface InstallState {
  target: InstallTarget
  /** Bumped on every tab switch and COPY press; it is the typed run's runKey. */
  run: number
}

/** Transitions: pick a tab, or press COPY (either one retypes the run). */
export type InstallAction = { type: "select"; target: InstallTarget } | { type: "copy" }

/** First render, on the server and the client: this machine, run 0. */
export const INITIAL_INSTALL_STATE: InstallState = { target: "host", run: 0 }

/** The tab switch retypes only when the target really changes; COPY always retypes. */
export function installReducer(state: InstallState, action: InstallAction): InstallState {
  switch (action.type) {
    case "select":
      return action.target === state.target ? state : { target: action.target, run: state.run + 1 }
    case "copy":
      return { target: state.target, run: state.run + 1 }
  }
}

/** The two tabs, in order (plain words only: no OS names, W1). */
export const INSTALL_TARGET_OPTIONS: readonly { value: InstallTarget; label: string }[] = [
  { value: "host", label: "THIS MACHINE" },
  { value: "phone", label: "ATTACHED PHONE" },
]

/** Every copy outcome. The COPY button is sized to the longest of their labels, so its width never changes on a press. */
export const COPY_STATES: readonly CopyState[] = ["idle", "copied", "selected"]

/** COPY button text for a copy outcome. */
export function copyButtonLabel(state: CopyState): string {
  switch (state) {
    case "copied":
      return "COPIED"
    case "selected":
      return "SELECTED"
    default:
      return "COPY"
  }
}

/** The polite announcement for a copy outcome ("" while idle). */
export function copyAnnouncement(state: CopyState): string {
  switch (state) {
    case "copied":
      return "Install command copied."
    case "selected":
      return "Clipboard unavailable. The install command is selected: copy it by hand."
    default:
      return ""
  }
}
