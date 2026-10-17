// The W13 repair gate sequence, shared by the L9 gate rail, the finale
// terminal's `heal` simulation and the /demo Repairs view (plan §5 L9, §4.4, §6.4).
// A real node waits at a human gate indefinitely: nothing auto-continues past one.

/**
 * How a station is passed:
 * - "machine": fills solid by itself when the fix reaches it;
 * - "human": stays hollow (`border border-foreground`) until its approve button is clicked;
 * - "upstream": the maintainers' review; the visitor advances it with `next`.
 */
export type HealGateKind = "machine" | "human" | "upstream"

/** One station of the gate rail. */
export interface HealGate {
  id: string
  /** Station label, uppercase as printed on the rail. */
  label: string
  kind: HealGateKind
  /** Button that passes a human or upstream station. */
  action?: string
  /** One plain line under the station. */
  note: string
}

/** APPROVED HERE → PR UPSTREAM → MAINTAINERS → MERGED → VIA GATEWAY → NODE B RE-CHECKS → NODE B'S OWNER. */
export const HEAL_GATES: readonly HealGate[] = [
  {
    id: "approved-here",
    label: "APPROVED HERE",
    kind: "human",
    action: "APPROVE ON THIS NODE",
    note: "you approve applying the fix on your node",
  },
  { id: "pr-upstream", label: "PR UPSTREAM", kind: "machine", note: "the fix goes upstream as a pull request" },
  { id: "maintainers", label: "MAINTAINERS", kind: "upstream", action: "next", note: "maintainers review upstream" },
  { id: "merged", label: "MERGED", kind: "machine", note: "the proven fix is merged" },
  { id: "via-gateway", label: "VIA GATEWAY", kind: "machine", note: "a gateway carries it to other nodes" },
  {
    id: "node-b-rechecks",
    label: "NODE B RE-CHECKS",
    kind: "machine",
    note: "node B's own local AI checks it again in its own sandbox",
  },
  {
    id: "node-b-owner",
    label: "NODE B'S OWNER",
    kind: "human",
    action: "APPROVE AS NODE B'S OWNER",
    note: "node B's owner has the final say",
  },
]

/** The rail as one line, e.g. for the terminal: "APPROVED HERE → PR UPSTREAM → …". */
export const HEAL_RAIL_LINE = HEAL_GATES.map((g) => g.label).join(" → ")

/** True when station `index` waits for a click (a human approval or the maintainers' `next`). */
export function waitsForVisitor(index: number): boolean {
  const gate = HEAL_GATES[index]
  return gate !== undefined && gate.kind !== "machine"
}
