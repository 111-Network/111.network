// Log-tail helpers of MiniTerminal (React-free). Real source: os/4-interface/ui/src/components/mini-terminal.tsx.

/** A typed command (`$ …`) is bright; output is muted. */
export function lineTone(line: string): "command" | "output" {
  return line.startsWith("$") ? "command" : "output"
}

/** How close (px) to the bottom still counts as "following the tail". */
export const PIN_SLACK_PX = 24

/** True when the reader is at (or within PIN_SLACK_PX of) the bottom, so new lines should scroll in. */
export function isPinnedToBottom(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight < PIN_SLACK_PX
}
